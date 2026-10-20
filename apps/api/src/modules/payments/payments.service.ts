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
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './interfaces/payment-gateway.interface';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  validatePaymentTransition,
} from '../../common/state-machines/state-machines';
import { env } from '../../config/env.config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
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

    const eventId = payload.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventType = payload.event;

    // Idempotency check: duplicate event check
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      this.logger.log(`Ignoring duplicate webhook event: ${eventId} (${eventType})`);
      return { status: 'ignored', reason: 'duplicate', eventId };
    }

    // Record webhook event in DB
    await this.prisma.webhookEvent.create({
      data: {
        eventId,
        provider: 'RAZORPAY',
        eventType: eventType || 'unknown',
        payload: payload as any,
      },
    });

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
        }
        break;
      }

      case 'refund.processed': {
        const paymentEntityId = payload.payload?.refund?.entity?.payment_id;
        if (paymentEntityId) {
          const payment = await this.prisma.payment.findFirst({
            where: { gatewayPaymentId: paymentEntityId },
          });

          if (payment && payment.status === 'CAPTURED') {
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
}
