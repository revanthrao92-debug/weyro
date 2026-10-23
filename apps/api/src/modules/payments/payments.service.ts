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
import { settleSparePartOrder } from '../spare-parts/spare-part-settlement';
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

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayOrderId: orderResult.orderId },
    });

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

    // State machine check
    validatePaymentTransition(payment.status, 'CAPTURED', user.role);

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId: dto.paymentId,
          gatewayOrderId: dto.orderId,
          paidAt: new Date(),
        },
      });

      return updated;
    });

    return {
      status: 'CAPTURED',
      payment: updatedPayment,
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

    // Validate money fields before recording/processing the event
    if (eventType === 'payment.captured') {
      const entity = payload?.payload?.payment?.entity;
      const orderId = entity?.order_id;

      if (!orderId) {
        throw new BadRequestException(
          'Webhook payment entity is missing order_id',
        );
      }

      const payment = await this.prisma.payment.findUnique({
        where: { gatewayOrderId: orderId },
      });

      // Spare-part orders are a separate settlement track with the same
      // gateway order namespace.
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
          this.logger.warn(
            `Rejected webhook ${eventId}: amount/currency mismatch for payment ${payment.id}`,
          );
          throw new BadRequestException(
            'Webhook amount or currency does not match the stored payment',
          );
        }
      } else if (sparePartOrder) {
        const expectedMinorUnits = Math.round(
          Number(sparePartOrder.totalAmount) * 100,
        );
        if (
          Number(entity.amount) !== expectedMinorUnits ||
          entity.currency !== sparePartOrder.currency
        ) {
          this.logger.warn(
            `Rejected webhook ${eventId}: amount/currency mismatch for spare part order ${sparePartOrder.id}`,
          );
          throw new BadRequestException(
            'Webhook amount or currency does not match the stored order',
          );
        }
      }
    }

    // Record webhook event in DB
    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId,
          provider: 'RAZORPAY',
          eventType: eventType || 'unknown',
          payload: payload as any,
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
      throw err;
    }

    this.logger.log(`Processing verified webhook event: ${eventId} (${eventType})`);

    // Process event types
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
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'CAPTURED',
                gatewayPaymentId: gatewayPaymentId || payment.gatewayPaymentId,
                paidAt: new Date(),
              },
            });
            this.logger.log(`Payment ${payment.id} transitioned to CAPTURED via webhook`);
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

            if (sparePartOrder && sparePartOrder.status === 'PENDING') {
              const settled = await this.prisma.$transaction((tx) =>
                settleSparePartOrder(
                  tx,
                  sparePartOrder,
                  gatewayPaymentId,
                  orderId,
                ),
              );
              this.logger.log(
                `Spare part order ${sparePartOrder.id} settled via webhook (${settled.status})`,
              );

              if (settled.status === 'PAID') {
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
        const refundEntity = payload.payload?.refund?.entity;
        const paymentEntityId = refundEntity?.payment_id;
        if (paymentEntityId) {
          const payment = await this.prisma.payment.findFirst({
            where: { gatewayPaymentId: paymentEntityId },
          });

          if (payment && payment.status === 'CAPTURED') {
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
              break;
            }

            validatePaymentTransition(payment.status, 'REFUNDED', 'SYSTEM');
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'REFUNDED' },
            });
            this.logger.log(`Payment ${payment.id} transitioned to REFUNDED via webhook`);
          }
        }
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event type: ${eventType}`);
        break;
    }

    return { status: 'processed', eventId, eventType };
  }

  /**
   * Release captured payment funds to the provider (escrow payout).
   * Only ADMIN or SYSTEM can trigger a release. Requires payment to be CAPTURED.
   */
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

    // State machine check: must be CAPTURED to release
    validatePaymentTransition(payment.status, 'RELEASED', actor.role);

    // Idempotency: if already released, return the existing record
    if (payment.status === 'RELEASED' && payment.payoutReference) {
      return {
        status: 'ALREADY_RELEASED',
        payment,
      };
    }

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'RELEASED',
          payoutReference: dto.payoutReference,
          paidToProviderAt: new Date(),
        },
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
