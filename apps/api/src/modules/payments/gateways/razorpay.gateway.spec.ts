import { RazorpayPaymentGateway } from './razorpay.gateway';

describe('RazorpayPaymentGateway error normalization', () => {
  const gateway = new RazorpayPaymentGateway({
    keyId: 'rzp_test_unit',
    keySecret: 'unit_key_secret',
    webhookSecret: 'unit_webhook_secret',
  });

  it('turns the SDK plain-object rejection into an Error with status and code', async () => {
    // Shape thrown by razorpay@2 normalizeError for an unknown payment id.
    (gateway as any).instance = {
      payments: {
        fetch: jest.fn().mockRejectedValue({
          statusCode: 400,
          error: { code: 'BAD_REQUEST_ERROR', description: 'The id provided does not exist' },
        }),
      },
    };

    const err = await gateway.fetchPayment('pay_missing').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('The id provided does not exist');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST_ERROR');
  });

  it('passes real Errors (network failures) through unchanged', async () => {
    const network = new Error('socket hang up');
    (gateway as any).instance = { orders: { create: jest.fn().mockRejectedValue(network) } };

    await expect(
      gateway.createOrder({ amountInPaise: 100, currency: 'INR', receipt: 'r1' } as any),
    ).rejects.toBe(network);
  });
});
