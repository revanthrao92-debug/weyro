import { notifyOrderPaid, notifyOrderPlaced } from './spare-part-notifications';

describe('parts order alerts carry the reference number', () => {
  const order = {
    orderId: 'o1',
    ref: 'O-261127-0007-3',
    partName: 'Engine Air Filter',
    totalAmount: 749,
    quantity: 1,
    customerUserId: 'c1',
    providerUserId: 'p1',
  };

  it('every message to the customer and the dealer ends with the order number', () => {
    const sent: { body: string }[] = [];
    const notifier = { sendPushNotification: jest.fn(async (p: any) => void sent.push(p)) } as any;
    notifyOrderPlaced(notifier, order);
    notifyOrderPaid(notifier, order);
    expect(sent).toHaveLength(3);
    for (const m of sent) expect(m.body.endsWith('Ref O-261127-0007-3.')).toBe(true);
  });
});
