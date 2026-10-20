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

  constructor() {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: MockPaymentGateway cannot be used in production environment!');
    }
    this.logger.warn('MockPaymentGateway initialized. Only for non-production development.');
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
}
