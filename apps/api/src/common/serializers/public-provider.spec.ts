import {
  toPaymentSummary,
  toPublicCustomer,
  toPublicProvider,
} from './public-provider';

const provider = {
  id: 'prov-1',
  userId: 'user-1',
  businessName: 'Sharma Motors',
  providerType: 'GARAGE',
  description: 'Multi-brand garage',
  phone: '+919876543210',
  address: '12 MG Road, Bengaluru',
  latitude: 12.97,
  longitude: 77.64,
  serviceRadiusKm: 15,
  verificationStatus: 'VERIFIED' as const,
  verificationDocuments: { license: 's3://private/license.pdf' },
  avgRating: 4.6,
  totalReviews: 120,
  completedJobs: 130,
  isAvailable: true,
  auditorNotes: 'internal only',
};

describe('public serializers', () => {
  it('projects providers down to marketing-safe fields', () => {
    const result = toPublicProvider(provider);

    expect(result).toMatchObject({
      id: 'prov-1',
      businessName: 'Sharma Motors',
      providerType: 'GARAGE',
      avgRating: 4.6,
      badge: 'PLATINUM',
    });
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('address');
    expect(result).not.toHaveProperty('latitude');
    expect(result).not.toHaveProperty('longitude');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('verificationDocuments');
    expect(result).not.toHaveProperty('auditorNotes');
  });

  it('never exposes saved addresses or contact data on customers', () => {
    const result = toPublicCustomer({
      id: 'cust-1',
      firstName: 'Asha',
      lastName: 'Rao',
      avatarUrl: null,
      // Extra fields are present on the Prisma row at runtime.
      ...({ phone: '+919876543210', savedAddresses: [{}], userId: 'u1' } as any),
    });

    expect(result).toEqual({
      id: 'cust-1',
      firstName: 'Asha',
      lastName: 'Rao',
      avatarUrl: null,
    });
  });

  it('strips gateway identifiers from payment summaries', () => {
    const result = toPaymentSummary({
      id: 'pay-1',
      status: 'CAPTURED',
      amount: '2000.00',
      currency: 'INR',
      method: 'UPI',
      paidAt: new Date('2026-01-01T00:00:00.000Z'),
      paidToProviderAt: null,
      gatewayOrderId: 'order_live_secret',
      gatewayPaymentId: 'pay_live_secret',
      payoutReference: 'internal-ref',
    });

    expect(result).toEqual({
      id: 'pay-1',
      status: 'CAPTURED',
      amount: 2000,
      currency: 'INR',
      method: 'UPI',
      paidAt: new Date('2026-01-01T00:00:00.000Z'),
      releasedAt: null,
    });
  });
});
