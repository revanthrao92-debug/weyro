import { Injectable, Logger, Optional } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import {
  CreateOrderParams,
  CreateOrderResult,
  PaymentGateway,
  RefundPaymentParams,
  RefundPaymentResult,
  VerifyPaymentParams,
} from '../interfaces/payment-gateway.interface';
import { env } from '../../../config/env.config';

@Injectable()
export class RazorpayPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(RazorpayPaymentGateway.name);
  private readonly instance: Razorpay;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    // Options exist for direct construction in tests; as a Nest provider this
    // dependency must be optional or the app cannot boot with Razorpay keys set.
    @Optional()
    options?: {
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
    },
  ) {
    const keyId = options?.keyId || env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = options?.keySecret || env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret =
      options?.webhookSecret ||
      env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      keySecret;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys must be configured to use RazorpayPaymentGateway');
    }
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret || keySecret;
    this.instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const order = await this.instance.orders.create({
      amount: params.amountInPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });

    return {
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  verifyPaymentSignature(params: VerifyPaymentParams): boolean {
    const { orderId, paymentId, signature } = params;
    try {
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(generatedSignature, 'utf8');

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (err: any) {
      this.logger.error(`Error verifying payment signature: ${err.message}`);
      return false;
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    try {
      const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (err: any) {
      this.logger.error(`Error verifying webhook signature: ${err.message}`);
      return false;
    }
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const refund = await this.instance.payments.refund(params.paymentId, {
      amount: params.amountInPaise,
      notes: params.notes,
    });

    return {
      refundId: refund.id,
      status: (refund as any).status || 'processed',
    };
  }
}
