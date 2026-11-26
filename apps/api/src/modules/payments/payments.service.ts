import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './interfaces/payment-gateway.interface';
import {
  CreateOrderDto,
  VerifyPaymentDto,
} from './dto/payment.dto';
import { ReleasePaymentDto } from './dto/release-payment.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  validatePaymentTransition,
} from '../../common/state-machines/state-machines';
import { NotificationsService } from '../notifications/notifications.service';
import { refundCancelledSpareOrder, settleBookingPayment, settleSparePartOrderPayment } from './settle-payment';
import { notifyOrderPaid } from '../spare-parts/spare-part-notifications';
import { env } from '../../config/env.config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async createOrder(dto: CreateOrderDto, user: AuthUserPayload) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        quotation: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${dto.bookingId} not found`);
    }

    if (
      user.role !== 'ADMIN' &&
      (!user.customerProfileId || booking.customerId !== user.customerProfileId)
    ) {
      throw new ForbiddenException('Only the booking customer can initiate payment');
    }

    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
      throw new ConflictException(
        'This booking is no longer accepting payment',
      );
    }

    let payment = booking.payments?.[0];
    if (!payment) {
      // Create payment record if it does not exist
      payment = await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.quotation.totalCost,
          currency: 'INR',
          status: 'PENDING',
          method: 'UPI',
        },
      });
    }

    if (payment.status === 'CAPTURED') {
      throw new ConflictException('Payment for this booking has already been captured');
    }
    if (payment.status === 'RELEASED' || payment.status === 'REFUNDED') {
      throw new ConflictException('This payment is already finalised');
    }

    // Amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(Number(payment.amount) * 100);

    // If order already created at gateway, return it
    if (payment.gatewayOrderId) {
      return {
        orderId: payment.gatewayOrderId,
        amount: Number(payment.amount),
        currency: payment.currency,
        keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      };
    }

    const orderResult = await this.gateway.createOrder({
      amountInPaise,
      currency: payment.currency,
      receipt: `rcpt_${payment.id.substring(0, 8)}`,
      notes: {
        bookingId: booking.id,
        paymentId: payment.id,
        customerId: booking.customerId,
      },
    });

    // M6: two concurrent create-order calls both reach the gateway. Only the
    // first to save wins (conditional update on gatewayOrderId IS NULL); the
    // loser returns the winner's order, so the client never pays against an
    // order the database no longer references.
    const saved = await this.prisma.payment.updateMany({
      where: { id: payment.id, gatewayOrderId: null },
      data: { gatewayOrderId: orderResult.orderId },
    });
    if (saved.count === 0) {
      const current = await this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      this.logger.warn(
        `create-order race on payment ${payment.id}: discarding gateway order ${orderResult.orderId}, using ${current.gatewayOrderId}`,
      );
      return {
        orderId: current.gatewayOrderId as string,
        amount: Number(current.amount),
        currency: current.currency,
        keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      };
    }

    return {
      orderId: orderResult.orderId,
      amount: Number(payment.amount),
      currency: payment.currency,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    };
  }

  async verifyPayment(dto: VerifyPaymentDto, user: AuthUserPayload) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${dto.bookingId} not found`);
    }

    if (
      user.role !== 'ADMIN' &&
      (!user.customerProfileId || booking.customerId !== user.customerProfileId)
    ) {
      throw new ForbiddenException('Only the booking customer can verify payment');
    }

    const payment = booking.payments?.[0];
    if (!payment) {
      throw new NotFoundException(`Payment record for booking ${dto.bookingId} not found`);
    }

    // Idempotent success if already captured
    if (payment.status === 'CAPTURED') {
      return { status: 'ALREADY_CAPTURED', payment };
    }

    if (payment.gatewayOrderId && payment.gatewayOrderId !== dto.orderId) {
      throw new BadRequestException('Mismatched gateway order ID');
    }

    // Verify cryptographic signature
    const isValid = this.gateway.verifyPaymentSignature({
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      signature: dto.signature,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature verification failed');
    }

    // H2: server-to-server binding — fetch the payment from Razorpay and
    // assert it really belongs to this order and this amount before touching
    // local state. A signature alone does not bind the amount.
    let remote;
    try {
      remote = await this.gateway.fetchPayment(dto.paymentId);
    } catch (err: any) {
      throw new BadRequestException(
        `Unable to confirm payment with the gateway: ${err?.message ?? 'fetch failed'}`,
      );
    }

    if (this.gateway.supportsServerBinding()) {
      const localMinor = Math.round(Number(payment.amount) * 100);
      if (
        remote.order_id !== dto.orderId ||
        remote.order_id !== payment.gatewayOrderId ||
        remote.amount !== localMinor ||
        remote.currency !== payment.currency
      ) {
        this.logger.warn(
          `Rejected client verify for payment ${payment.id}: gateway amount/currency/order mismatch`,
        );
        throw new BadRequestException(
          'Gateway payment amount or order does not match this record',
        );
      }
      // M4: `authorized` is NOT paid. Capture it ourselves for exactly the
      // amount we expect, and only settle once the gateway reports `captured`.
      if (remote.status === 'authorized') {
        try {
          remote = await this.gateway.capturePayment(
            dto.paymentId,
            localMinor,
            payment.currency,
          );
        } catch (err: any) {
          throw new BadRequestException(
            `Unable to capture the authorized payment: ${err?.message ?? 'capture failed'}`,
          );
        }
      }
      if (remote.status !== 'captured') {
        throw new BadRequestException(
          `Gateway payment is not captured (status: ${remote.status})`,
        );
      }
    }

    // STEP 1: single shared, idempotent settlement (same fn the webhook
    // uses). A racing webhook claim is a safe no-op, not an error.
    const settleResult = await this.prisma.$transaction(async (tx) =>
      settleBookingPayment(tx, { paymentId: payment.id }, {
        gatewayPaymentId: dto.paymentId,
        gatewayOrderId: dto.orderId,
      }),
    );

    if (!settleResult.applied) {
      const settledRow = await this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      return {
        status: settleResult.alreadySettled ? 'ALREADY_CAPTURED' : 'IDEMPOTENT_NOOP',
        payment: settledRow,
      };
    }

    const settledPayment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });

    return {
      status: 'CAPTURED',
      payment: settledPayment,
    };
  }

  async handleWebhook(rawBody: string | Buffer, signature: string, payload: any) {
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }

    const isValid = this.gateway.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('Rejected webhook with invalid HMAC SHA256 signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventId = payload?.id;
    if (typeof eventId !== 'string' || eventId.length === 0) {
      throw new BadRequestException(
        'Webhook payload is missing a gateway event id',
      );
    }
    const eventType = payload?.event;

    // Idempotency check: duplicate event check
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      this.logger.log(`Ignoring duplicate webhook event: ${eventId} (${eventType})`);
      return { status: 'ignored', reason: 'duplicate', eventId };
    }

    // STEP 4: amount/currency validation happens AFTER the event row is persisted.
    // Mismatched webhooks are stored with outcome 'rejected' AND answered with a
    // 200 no-op (Razorpay stops retrying them). Legit ones proceed, and if the
    // handler below throws the row is retried next cycle (outcome stamped then).

    // Record webhook event FIRST (returns 200 semantics started here)
    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId,
          provider: 'RAZORPAY',
          eventType: eventType || 'unknown',
          payload: payload as never,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.log(`Ignoring concurrently recorded webhook: ${eventId}`);
        return { status: 'ignored', reason: 'duplicate', eventId };
      }
      throw err; // Booking the event failed — 500 so Razorpay retries and the row eventually lands.
    }

    // STEP 4 — amount/currency binding AFTER persistence (never rejects the
    // request — mismatches are permanently recorded as outcome=rejected and
    // Razorpay retries are then no-ops because the event id row exists).
    let moneyRejected: string | null = null;
    if (eventType === 'payment.captured') {
      const entity = payload?.payload?.payment?.entity;
      const orderId = entity?.order_id;

      if (orderId) {
        const payment = await this.prisma.payment.findUnique({
          where: { gatewayOrderId: orderId },
        });

        const sparePartOrder = payment
          ? null
          : await this.prisma.sparePartOrder.findUnique({
              where: { gatewayOrderId: orderId },
            });

        if (payment) {
          const expectedMinorUnits = Math.round(Number(payment.amount) * 100);
          if (
            Number(entity.amount) !== expectedMinorUnits ||
            entity.currency !== payment.currency
          ) {
            moneyRejected = `amount/currency mismatch for payment ${payment.id}`;
          }
        } else if (sparePartOrder) {
          const expectedMinorUnits = Math.round(
            Number(sparePartOrder.totalAmount) * 100,
          );
          if (
            Number(entity.amount) !== expectedMinorUnits ||
            entity.currency !== sparePartOrder.currency
          ) {
            moneyRejected = `amount/currency mismatch for spare part order ${sparePartOrder.id}`;
          }
        }
      }
    }

    if (moneyRejected) {
      this.logger.warn(`Webhook ${eventId} recorded as rejected: ${moneyRejected}`);
      await this.prisma.webhookEvent.update({
        where: { eventId },
        data: { eventType: `${eventType || 'unknown'}#rejected` },
      });
      return { status: 'ignored', reason: moneyRejected, eventId };
    }

    this.logger.log(`Processing verified webhook event: ${eventId} (${eventType})`);

    // Process event types. If handling fails, remove the dedupe row so the
    // gateway's retry actually reprocesses the event instead of being ignored
    // as a duplicate. Settlement claims are idempotent.
    try {
      switch (eventType) {
      case 'payment.captured': {
        const orderId = payload.payload?.payment?.entity?.order_id;
        const gatewayPaymentId = payload.payload?.payment?.entity?.id;

        if (orderId) {
          const payment = await this.prisma.payment.findUnique({
            where: { gatewayOrderId: orderId },
          });

          if (payment && payment.status !== 'CAPTURED') {
            validatePaymentTransition(payment.status, 'CAPTURED', 'SYSTEM');
            // M5: the SAME idempotent claim /payments/verify uses. Racing
            // webhook duplicates or a client verify cannot double-apply it.
            const settled = await this.prisma.$transaction((tx) =>
              settleBookingPayment(tx, { paymentId: payment.id }, {
                gatewayPaymentId: gatewayPaymentId || payment.gatewayPaymentId || '',
                gatewayOrderId: orderId,
              }),
            );
            if (settled.applied) {
              this.logger.log(`Payment ${payment.id} transitioned to CAPTURED via webhook`);
            } else {
              this.logger.warn(
                `Webhook ${eventId}: payment ${payment.id} already transitioned concurrently — skipping capture`,
              );
            }
          }

          // Spare-part orders are settled by the same captured event when no
          // booking payment owns the gateway order id.
          if (!payment) {
            const sparePartOrder = await this.prisma.sparePartOrder.findUnique({
              where: { gatewayOrderId: orderId },
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
                customerId: true,
                providerId: true,
                totalAmount: true,
                sparePart: { select: { name: true } },
                customer: { select: { userId: true } },
                provider: { select: { userId: true } },
              },
            });

            if (sparePartOrder && sparePartOrder.status === 'CANCELLED') {
              await this.refundCancelledSpareOrder(
                sparePartOrder.id,
                gatewayPaymentId,
                sparePartOrder.totalAmount,
              );
            }

            if (sparePartOrder && sparePartOrder.status === 'PENDING') {
              const settled = await this.prisma.$transaction((tx) =>
                settleSparePartOrderPayment(
                  tx,
                  {
                    orderId: sparePartOrder.id,
                    sparePartId: sparePartOrder.sparePartId,
                    quantity: sparePartOrder.quantity,
                  },
                  { gatewayPaymentId, gatewayOrderId: orderId },
                ),
              );
              this.logger.log(
                `Spare part order ${sparePartOrder.id} settled via webhook (${settled.status ?? 'no-op'})`,
              );
              if (settled.outOfStock) {
                await this.refundCancelledSpareOrder(sparePartOrder.id, gatewayPaymentId, sparePartOrder.totalAmount, 'sold_out_after_capture');
              }

              if (settled.applied) {
                notifyOrderPaid(this.notifications, {
                  orderId: sparePartOrder.id,
                  partName: sparePartOrder.sparePart?.name ?? 'your order',
                  totalAmount: Number(sparePartOrder.totalAmount),
                  quantity: sparePartOrder.quantity,
                  customerUserId: sparePartOrder.customer?.userId,
                  providerUserId: sparePartOrder.provider?.userId,
                });
              }
            }
          }
        }
        break;
      }

      case 'payment.failed': {
        const orderId = payload.payload?.payment?.entity?.order_id;
        if (orderId) {
          const payment = await this.prisma.payment.findUnique({
            where: { gatewayOrderId: orderId },
          });

          if (payment && payment.status === 'PENDING') {
            validatePaymentTransition(payment.status, 'FAILED', 'SYSTEM');
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED' },
            });
            this.logger.warn(`Payment ${payment.id} transitioned to FAILED via webhook`);
          }

          if (!payment) {
            const failedOrders = await this.prisma.sparePartOrder.updateMany({
              where: { gatewayOrderId: orderId, status: 'PENDING' },
              data: { status: 'FAILED' },
            });
            if (failedOrders.count > 0) {
              this.logger.warn(
                `Spare part order(s) for gateway order ${orderId} transitioned to FAILED via webhook`,
              );
            }
          }
        }
        break;
      }

      case 'refund.processed': {
        await this.handleRefundProcessed(eventId, payload.payload?.refund?.entity);
        break;
      }

      case 'refund.failed': {
        await this.handleRefundFailed(eventId, payload.payload?.refund?.entity);
        break;
      }

        default:
          this.logger.log(`Unhandled webhook event type: ${eventType}`);
          break;
      }
    } catch (error) {
      await this.prisma.webhookEvent
        .deleteMany({ where: { eventId } })
        .catch(() => undefined);
      throw error;
    }

    return { status: 'processed', eventId, eventType };
  }

  /**
   * M3: refund a CAPTURED booking payment (e.g. the booking was cancelled
   * after the customer paid). Records a Refund row, asks the gateway to
   * refund, and leaves the payment in REFUND_PENDING until the
   * `refund.processed` webhook confirms. If the gateway refuses, nothing left
   * the account: the payment goes back to CAPTURED and the failure is logged
   * and audited so support can follow up. Never throws.
   */
  async refundCapturedBookingPayment(
    paymentId: string,
    opts: { reason: string; actorId?: string; actorRole?: string },
  ): Promise<{ status: 'REFUND_PENDING' | 'REFUNDED' | 'FAILED' | 'SKIPPED'; refundId?: string }> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'CAPTURED') {
      return { status: 'SKIPPED' };
    }
    const amountInPaise = Math.round(Number(payment.amount) * 100);

    // Claim: only one caller may move CAPTURED -> REFUND_PENDING.
    const refundRow = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'CAPTURED' },
        data: { status: 'REFUND_PENDING' },
      });
      if (claimed.count === 0) return null;
      return tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          reason: opts.reason,
        },
      });
    });
    if (!refundRow) return { status: 'SKIPPED' };

    try {
      if (!payment.gatewayPaymentId) {
        throw new Error('payment has no gateway payment id');
      }
      // Reuse a refund a timed-out earlier attempt already created.
      const existing = await this.gateway.findRefund?.(payment.gatewayPaymentId, amountInPaise);
      const result =
        existing ??
        (await this.gateway.refundPayment({
          paymentId: payment.gatewayPaymentId,
          amountInPaise,
          notes: { paymentId: payment.id, bookingId: payment.bookingId, reason: opts.reason },
        }));

      await this.prisma.refund.update({
        where: { id: refundRow.id },
        data: { gatewayRefundId: result.refundId },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: opts.actorId,
          actorRole: opts.actorRole,
          action: 'payment.refund_requested',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: { refundId: result.refundId, amount: Number(payment.amount), reason: opts.reason },
        },
      });
      this.logger.log(
        `Refund ${result.refundId} requested for payment ${payment.id} (${opts.reason}); awaiting webhook`,
      );

      // The mock gateway never sends webhooks, so confirm immediately in dev.
      if (!this.gateway.supportsServerBinding()) {
        await this.confirmRefund(refundRow.id, payment.id);
        return { status: 'REFUNDED', refundId: refundRow.id };
      }
      return { status: 'REFUND_PENDING', refundId: refundRow.id };
    } catch (error) {
      const message = (error as Error).message;
      await this.failRefund(refundRow.id, payment.id, message, opts);
      return { status: 'FAILED', refundId: refundRow.id };
    }
  }

  /** Refund confirmed: Refund PROCESSED, payment REFUND_PENDING -> REFUNDED. */
  private async confirmRefund(refundId: string, paymentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.refund.updateMany({
        where: { id: refundId, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'PROCESSED', failureReason: null },
      });
      await tx.payment.updateMany({
        where: { id: paymentId, status: 'REFUND_PENDING' },
        data: { status: 'REFUNDED' },
      });
    });
  }

  /** Refund failed: Refund FAILED, payment REFUND_PENDING -> CAPTURED, loud log + audit. */
  private async failRefund(
    refundId: string,
    paymentId: string,
    reason: string,
    actor?: { actorId?: string; actorRole?: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.refund.updateMany({
        where: { id: refundId, status: { not: 'PROCESSED' } },
        data: { status: 'FAILED', failureReason: reason.slice(0, 500) },
      });
      await tx.payment.updateMany({
        where: { id: paymentId, status: 'REFUND_PENDING' },
        data: { status: 'CAPTURED' },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor?.actorId,
          actorRole: actor?.actorRole,
          action: 'payment.refund_failed',
          entityType: 'Payment',
          entityId: paymentId,
          newValues: { refundId, reason: reason.slice(0, 500) },
        },
      });
    });
    this.logger.error(
      `Refund ${refundId} for payment ${paymentId} FAILED (${reason}). The customer was NOT refunded — manual follow-up required.`,
    );
  }

  /** `refund.processed` webhook: confirm our refund, or record one made outside the API. */
  private async handleRefundProcessed(eventId: string, refundEntity: any): Promise<void> {
    const gatewayRefundId: string | undefined = refundEntity?.id;
    const gatewayPaymentId: string | undefined = refundEntity?.payment_id;
    if (!gatewayPaymentId) return;

    const payment = await this.prisma.payment.findFirst({ where: { gatewayPaymentId } });
    if (!payment || !['CAPTURED', 'REFUND_PENDING'].includes(payment.status)) return;

    const refundMinorUnits = Number(refundEntity?.amount);
    const capturedMinorUnits = Math.round(Number(payment.amount) * 100);
    if (
      !Number.isFinite(refundMinorUnits) ||
      refundMinorUnits > capturedMinorUnits ||
      refundEntity?.currency !== payment.currency
    ) {
      this.logger.warn(
        `Rejected refund ${eventId}: amount/currency mismatch for payment ${payment.id}`,
      );
      return;
    }
    if (refundMinorUnits < capturedMinorUnits) {
      this.logger.warn(
        `Partial refund ${eventId} for payment ${payment.id} (${refundMinorUnits}/${capturedMinorUnits}) — local status left ${payment.status}`,
      );
      return;
    }

    // Our own refund (matched by gateway id, else the open one for this payment)
    // or one issued from the gateway dashboard (recorded now for the audit trail).
    let refund =
      (gatewayRefundId
        ? await this.prisma.refund.findUnique({ where: { gatewayRefundId } })
        : null) ??
      (await this.prisma.refund.findFirst({
        where: { paymentId: payment.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }));
    if (!refund) {
      refund = await this.prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          gatewayRefundId,
          reason: 'gateway_dashboard',
        },
      });
    } else if (gatewayRefundId && !refund.gatewayRefundId) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { gatewayRefundId },
      });
    }

    // CAPTURED -> REFUND_PENDING (dashboard refund) is a legal step on the way.
    if (payment.status === 'CAPTURED') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'CAPTURED' },
        data: { status: 'REFUND_PENDING' },
      });
    }
    await this.confirmRefund(refund.id, payment.id);
    this.logger.log(`Payment ${payment.id} transitioned to REFUNDED via webhook`);
  }

  /** `refund.failed` webhook: the customer was not refunded. */
  private async handleRefundFailed(eventId: string, refundEntity: any): Promise<void> {
    const gatewayRefundId: string | undefined = refundEntity?.id;
    const gatewayPaymentId: string | undefined = refundEntity?.payment_id;

    const refund =
      (gatewayRefundId
        ? await this.prisma.refund.findUnique({ where: { gatewayRefundId } })
        : null) ??
      (gatewayPaymentId
        ? await this.prisma.refund.findFirst({
            where: { payment: { gatewayPaymentId }, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
          })
        : null);
    if (!refund) {
      this.logger.warn(`Refund failure ${eventId} matches no known refund — ignoring`);
      return;
    }
    await this.failRefund(
      refund.id,
      refund.paymentId,
      refundEntity?.error_description || refundEntity?.status || 'refund.failed webhook',
    );
  }

  /**
   * Release captured payment funds to the provider (escrow payout).
   * Only ADMIN or SYSTEM can trigger a release. Requires payment to be CAPTURED.
   */
  /**
   * A capture can arrive after the customer cancelled the order. Refund it
   * once, reusing an existing gateway refund if a previous retry succeeded.
   */
  private async refundCancelledSpareOrder(
    orderId: string,
    gatewayPaymentId: string | undefined,
    amount: unknown,
    reason = 'cancelled_after_capture',
  ): Promise<void> {
    await refundCancelledSpareOrder(this.prisma, this.gateway, { orderId, gatewayPaymentId, amount, reason });
  }

  async releasePayment(
    dto: ReleasePaymentDto,
    actor: AuthUserPayload,
  ) {
    // Authorization: only admin or system can release escrow funds
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can release escrow funds');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        provider: true,
        customer: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${dto.bookingId} not found`);
    }

    const payment = booking.payments?.[0];
    if (!payment) {
      throw new NotFoundException(`Payment record for booking ${dto.bookingId} not found`);
    }

    if (booking.status !== 'COMPLETED') {
      throw new ConflictException(
        'Payment can only be released after the booking is completed',
      );
    }

    // State machine check: must be CAPTURED to release. RELEASED itself is an
    // idempotent success (handled below), REFUNDED is caught by the machine.
    validatePaymentTransition(payment.status, 'RELEASED', actor.role);

    // Idempotency: if already released, return the existing record
    if (payment.status === 'RELEASED' && payment.payoutReference) {
      return {
        status: 'ALREADY_RELEASED',
        payment,
      };
    }

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // H3: conditional claim — only a CAPTURED payment can transition to
      // RELEASED, enforced by the WHERE precondition so a concurrent release
      // (double-click/admin retry) cannot apply twice.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'CAPTURED' },
        data: {
          status: 'RELEASED',
          payoutReference: dto.payoutReference,
          paidToProviderAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new ConflictException(
          'Payment release raced with another transition (no longer CAPTURED)',
        );
      }

      const updated = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          actorRole: actor.role,
          action: 'payment.release',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: {
            status: 'RELEASED',
            payoutReference: dto.payoutReference,
            paidToProviderAt: new Date().toISOString(),
          },
        },
      });

      return updated;
    });

    // Notify provider of payout
    try {
      if (booking.provider?.userId) {
        this.notifications
          .sendPushNotification({
            userId: booking.provider.userId,
            title: 'Escrow Payout Released 💰',
            body: `Payment of ₹${Number(updatedPayment.amount).toLocaleString('en-IN')} for booking #${booking.id.slice(0, 8)} has been released to your account.`,
            data: {
              type: 'PAYMENT_RELEASED',
              bookingId: booking.id,
              paymentId: updatedPayment.id,
              payoutReference: dto.payoutReference,
            },
          })
          .catch(() => {});
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return {
      status: 'RELEASED',
      payment: updatedPayment,
    };
  }
}
