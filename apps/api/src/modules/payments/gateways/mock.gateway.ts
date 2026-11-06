import { Injectable, Logger } from '@nestjs/common';
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
export class MockPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);
  /** In-memory memory of created orders so fetchPayment can bind truthfully. */
  private readonly createdOrders = new Map<
    string,
    { amount: number; currency: string }
  >();

  constructor() {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: MockPaymentGateway cannot be used in production environment!');
    }
    this.logger.warn('MockPaymentGateway initialized. Only for non-production development.');
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.createdOrders.set(mockOrderId, {
      amount: params.amountInPaise,
      currency: params.currency,
    });
    return {
      orderId: mockOrderId,
      amount: params.amountInPaise,
      currency: params.currency,
    };
  }

  verifyPaymentSignature(params: VerifyPaymentParams): boolean {
    const { signature } = params;
    return signature.startsWith('mock_') || signature.length >= 10;
  }

  verifyWebhookSignature(_rawBody: string | Buffer, signature: string): boolean {
    return signature.startsWith('mock_') || signature.length >= 10;
  }

  async refundPayment(_params: RefundPaymentParams): Promise<RefundPaymentResult> {
    return {
      refundId: `rfnd_mock_${Date.now()}`,
      status: 'processed',
    };
  }

  /** Mock gateway: returns the REAL created-order data so server-side
   *  binding (settle-payment) works in dev/test exactly like production. */
  async fetchPayment(
    paymentId: string,
  ): Promise<{
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    // The order id is discoverable through the already-held runtime linkage.
    // Without it we cannot bind truthfully — tests must seed createdOrders
    // via createOrder first.
    const created = [...this.createdOrders.entries()].pop();
    if (!created) {
      throw new Error('Mock gateway has no created orders to fetch from');
    }
    const [order_id, stored] = created;
    return {
      id: paymentId,
      order_id,
      amount: stored.amount,
      currency: stored.currency,
      status: 'captured',
    };
  }
}
