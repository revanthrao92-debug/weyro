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

/** Authoritative server-to-server view of a gateway payment (H2). */
export interface GatewayPaymentInfo {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentGateway {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPaymentSignature(params: VerifyPaymentParams): boolean;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
  /** Fetch the real payment record from the gateway (server-to-server). */
  fetchPayment(paymentId: string): Promise<GatewayPaymentInfo>;
  /**
   * Capture an `authorized` payment for exactly `amountInPaise` (M4). Returns
   * the payment as the gateway sees it afterwards.
   */
  capturePayment(
    paymentId: string,
    amountInPaise: number,
    currency: string,
  ): Promise<GatewayPaymentInfo>;
  /** Fetch every payment attempt for an order (used by reconciliation). */
  fetchOrderPayments?(orderId: string): Promise<GatewayPaymentInfo[]>;
  /** Find an existing refund so a timed-out retry does not refund twice. */
  findRefund?(
    paymentId: string,
    amountInPaise?: number,
  ): Promise<RefundPaymentResult | null>;
  /** Whether this gateway supports authoritative server-side binding (real gateways do; mocks don't). */
  supportsServerBinding(): boolean;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
