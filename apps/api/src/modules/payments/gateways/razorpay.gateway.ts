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
    // H1 fix: the webhook secret MUST be independently configured. Falling
    // back to the API key secret let a single secret leak forge captured
    // webhooks. Real webhook signing secrets are only required when webhooks
    // are used; an explicit empty value disables webhook verification rather
    // than silently reusing the API secret.
    const webhookSecret =
      options?.webhookSecret ||
      env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys must be configured to use RazorpayPaymentGateway');
    }
    // Recognized placeholder shapes (dev defaults) must never reach production.
    const looksLikePlaceholder =
      /^rzp_.*(placeholder|sample|test_placeholder)/i.test(webhookSecret ?? '');
    if (
      process.env.NODE_ENV === 'production' &&
      (!webhookSecret || looksLikePlaceholder || webhookSecret === keySecret)
    ) {
      throw new Error(
        'RAZORPAY_WEBHOOK_SECRET must be set to an independent, non-placeholder value in production',
      );
    }
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret || '';
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

  /**
   * H2: authoritative server-to-server fetch of a payment from Razorpay.
   * Used to bind amount/currency/order to the local record before any
   * client-driven "verify" marks money as captured.
   */
  async fetchPayment(
    paymentId: string,
  ): Promise<{
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    const payment = await this.instance.payments.fetch(paymentId);
    return {
      id: payment.id,
      order_id: payment.order_id,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
    };
  }

  verifyPaymentSignature(params: VerifyPaymentParams): boolean {    const { orderId, paymentId, signature } = params;
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
