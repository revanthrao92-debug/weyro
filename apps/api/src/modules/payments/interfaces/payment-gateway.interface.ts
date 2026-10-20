export interface CreateOrderParams {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RefundPaymentParams {
  paymentId: string;
  amountInPaise?: number;
  notes?: Record<string, string>;
}

export interface RefundPaymentResult {
  refundId: string;
  status: string;
}

export interface PaymentGateway {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPaymentSignature(params: VerifyPaymentParams): boolean;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
