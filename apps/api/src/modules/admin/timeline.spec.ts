import { buildTimeline, timelineLine, type TimelineEvent } from './timeline';

const ev = (over: Partial<TimelineEvent>): TimelineEvent => ({
  occurredAt: new Date('2026-11-27T05:00:00Z'),
  type: 'status_changed',
  entityType: 'Job',
  entityRef: 'J-261127-0001-1',
  fromStatus: null,
  toStatus: null,
  source: 'live',
  data: {},
  ...over,
});

const STATUSES: Record<string, string[]> = {
  Request: ['DRAFT', 'OPEN', 'QUOTES_RECEIVED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
  Quote: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'],
  Job: ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'],
  PartsOrder: ['PENDING', 'PAID', 'CANCELLED', 'FAILED', 'REFUNDED'],
  DriverTrip: ['REQUESTED', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'],
  Payment: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'REFUND_PENDING', 'REFUNDED', 'FAILED'],
  Refund: ['PENDING', 'PROCESSED', 'FAILED'],
};

describe('admin timeline wording', () => {
  it('every status of every record type reads as a sentence, never a code', () => {
    for (const [entityType, statuses] of Object.entries(STATUSES)) {
      for (const toStatus of statuses) {
        const line = timelineLine(ev({ entityType, toStatus }))!;
        expect(line.text).not.toMatch(/[A-Z]{2,}|_|Status changed/);
      }
    }
    for (const toStatus of ['PENDING', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']) {
      expect(timelineLine(ev({ entityType: 'PartsOrder', type: 'fulfillment_changed', toStatus }))!.text).not.toMatch(/[A-Z]{2,}|_/);
    }
  });

  it('says what happened with the money', () => {
    expect(timelineLine(ev({ entityType: 'PartsOrder', type: 'created', data: { quantity: 2, partName: 'Headlamp', totalAmount: 25998 } }))!.text).toBe(
      'Order placed: 2 × Headlamp, ₹25,998',
    );
    expect(timelineLine(ev({ entityType: 'PartsOrder', toStatus: 'PAID', data: { totalAmount: 749 } }))!.text).toBe('Customer paid ₹749');
    expect(timelineLine(ev({ entityType: 'PartsOrder', type: 'fulfillment_changed', toStatus: 'SHIPPED' }))!.text).toBe('Dealer marked it shipped');
  });

  it('marks problems, leaves training text out, and sorts oldest first', () => {
    const lines = buildTimeline([
      ev({ occurredAt: new Date('2026-11-27T06:00:00Z'), toStatus: 'CANCELLED' }),
      ev({ type: 'text', data: { field: 'notes', text: 'x' } }),
      ev({ occurredAt: new Date('2026-11-27T04:00:00Z'), type: 'created' }),
    ]);
    expect(lines.map((l) => [l.text, l.tone])).toEqual([
      ['Job booked', 'neutral'],
      ['Job cancelled', 'problem'],
    ]);
  });

  it('older history without amounts borrows them from the record\'s own creation', () => {
    const lines = buildTimeline([
      ev({ entityType: 'PartsOrder', entityRef: 'O-1', type: 'created', data: { quantity: 1, partName: 'Filter', totalAmount: 749 } }),
      ev({ entityType: 'PartsOrder', entityRef: 'O-1', toStatus: 'PAID', source: 'backfill', data: {} }),
    ]);
    expect(lines[1].text).toBe('Customer paid ₹749');
  });
});
