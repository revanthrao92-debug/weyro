import { ConflictException } from '@nestjs/common';
import {
  validateBookingTransition,
  validatePaymentTransition,
  validateQuotationTransition,
  validateServiceRequestTransition,
} from './state-machines';

describe('State Machines', () => {
  describe('validateServiceRequestTransition', () => {
    it('allows valid customer transition from DRAFT to OPEN', () => {
      expect(() =>
        validateServiceRequestTransition('DRAFT', 'OPEN', 'CUSTOMER'),
      ).not.toThrow();
    });

    it('allows valid provider/system transition from OPEN to QUOTES_RECEIVED', () => {
      expect(() =>
        validateServiceRequestTransition('OPEN', 'QUOTES_RECEIVED', 'PROVIDER'),
      ).not.toThrow();
    });

    it('rejects illegal transition from DRAFT directly to COMPLETED with 409 Conflict', () => {
      expect(() =>
        validateServiceRequestTransition('DRAFT', 'COMPLETED', 'CUSTOMER'),
      ).toThrow(ConflictException);
    });

    it('rejects unauthorized actor attempting transition', () => {
      // Customer cannot expire a request
      expect(() =>
        validateServiceRequestTransition('OPEN', 'EXPIRED', 'CUSTOMER'),
      ).toThrow(ConflictException);
    });
  });

  describe('validateQuotationTransition', () => {
    it('allows customer to accept a PENDING quotation', () => {
      expect(() =>
        validateQuotationTransition('PENDING', 'ACCEPTED', 'CUSTOMER'),
      ).not.toThrow();
    });

    it('allows provider to withdraw their own PENDING quotation', () => {
      expect(() =>
        validateQuotationTransition('PENDING', 'WITHDRAWN', 'PROVIDER'),
      ).not.toThrow();
    });

    it('rejects illegal transition from ACCEPTED to WITHDRAWN', () => {
      expect(() =>
        validateQuotationTransition('ACCEPTED', 'WITHDRAWN', 'PROVIDER'),
      ).toThrow(ConflictException);
    });
  });

  describe('validateBookingTransition', () => {
    it('allows provider to transition CONFIRMED to PROVIDER_EN_ROUTE and then IN_PROGRESS', () => {
      expect(() =>
        validateBookingTransition('CONFIRMED', 'PROVIDER_EN_ROUTE', 'PROVIDER'),
      ).not.toThrow();
      expect(() =>
        validateBookingTransition('PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'PROVIDER'),
      ).not.toThrow();
    });

    it('allows provider to complete work', () => {
      expect(() =>
        validateBookingTransition('IN_PROGRESS', 'COMPLETED', 'PROVIDER'),
      ).not.toThrow();
    });

    it('allows customer to dispute completed work', () => {
      expect(() =>
        validateBookingTransition('COMPLETED', 'DISPUTED', 'CUSTOMER'),
      ).not.toThrow();
    });

    it('rejects customer trying to mark work completed', () => {
      expect(() =>
        validateBookingTransition('IN_PROGRESS', 'COMPLETED', 'CUSTOMER'),
      ).toThrow(ConflictException);
    });

    it('rejects illegal transition from COMPLETED back to CONFIRMED', () => {
      expect(() =>
        validateBookingTransition('COMPLETED', 'CONFIRMED', 'ADMIN'),
      ).toThrow(ConflictException);
    });
  });

  describe('validatePaymentTransition', () => {
    it('allows system transition from PENDING to AUTHORIZED', () => {
      expect(() =>
        validatePaymentTransition('PENDING', 'AUTHORIZED', 'SYSTEM'),
      ).not.toThrow();
    });

    it('allows system transition from AUTHORIZED to CAPTURED', () => {
      expect(() =>
        validatePaymentTransition('AUTHORIZED', 'CAPTURED', 'SYSTEM'),
      ).not.toThrow();
    });

    it('allows refund on captured payment', () => {
      expect(() =>
        validatePaymentTransition('CAPTURED', 'REFUNDED', 'ADMIN'),
      ).not.toThrow();
    });

    it('allows a later capture after an earlier failed attempt', () => {
      expect(() =>
        validatePaymentTransition('FAILED', 'CAPTURED', 'SYSTEM'),
      ).not.toThrow();
    });
  });
});

import {
  PAYMENT_REQUIRED_BEFORE,
  assertPaymentSatisfied,
  validatePaymentTransition as validatePayment,
} from './state-machines';

describe('M3 – payment policy gate', () => {
  it('defaults to requiring payment before COMPLETED', () => {
    expect(PAYMENT_REQUIRED_BEFORE).toBe('COMPLETED');
  });

  it.each(['PENDING', 'AUTHORIZED', 'FAILED', 'REFUND_PENDING', 'REFUNDED', undefined, null] as const)(
    'refuses COMPLETED when the payment is %s',
    (paymentStatus) => {
      expect(() =>
        assertPaymentSatisfied({ targetStatus: 'COMPLETED', paymentStatus: paymentStatus as never, actorRole: 'PROVIDER' }),
      ).toThrow(/Payment must be captured/);
    },
  );

  it.each(['CAPTURED', 'RELEASED'] as const)('allows COMPLETED when the payment is %s', (paymentStatus) => {
    expect(
      assertPaymentSatisfied({ targetStatus: 'COMPLETED', paymentStatus, actorRole: 'PROVIDER' }),
    ).toEqual({ overridden: false });
  });

  it('does not gate other transitions under the default policy', () => {
    for (const targetStatus of ['PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'CANCELLED', 'DISPUTED'] as const) {
      expect(
        assertPaymentSatisfied({ targetStatus, paymentStatus: 'PENDING', actorRole: 'PROVIDER' }),
      ).toEqual({ overridden: false });
    }
  });

  it('can be switched to IN_PROGRESS: then starting AND completing need payment', () => {
    const policy = 'IN_PROGRESS' as const;
    expect(() =>
      assertPaymentSatisfied({ targetStatus: 'IN_PROGRESS', paymentStatus: 'PENDING', actorRole: 'PROVIDER', policy }),
    ).toThrow(/Payment must be captured/);
    expect(() =>
      assertPaymentSatisfied({ targetStatus: 'COMPLETED', paymentStatus: 'PENDING', actorRole: 'PROVIDER', policy }),
    ).toThrow(/Payment must be captured/);
    expect(
      assertPaymentSatisfied({ targetStatus: 'IN_PROGRESS', paymentStatus: 'CAPTURED', actorRole: 'PROVIDER', policy }),
    ).toEqual({ overridden: false });
    expect(
      assertPaymentSatisfied({ targetStatus: 'PROVIDER_EN_ROUTE', paymentStatus: 'PENDING', actorRole: 'PROVIDER', policy }),
    ).toEqual({ overridden: false });
  });

  it('lets an ADMIN override only with a reason, and returns it for the audit log', () => {
    expect(
      assertPaymentSatisfied({
        targetStatus: 'COMPLETED',
        paymentStatus: 'PENDING',
        actorRole: 'ADMIN',
        overrideReason: '  Customer paid cash on site  ',
      }),
    ).toEqual({ overridden: true, reason: 'Customer paid cash on site' });
    expect(() =>
      assertPaymentSatisfied({ targetStatus: 'COMPLETED', paymentStatus: 'PENDING', actorRole: 'ADMIN' }),
    ).toThrow(/admins may override/);
    expect(() =>
      assertPaymentSatisfied({ targetStatus: 'COMPLETED', paymentStatus: 'PENDING', actorRole: 'ADMIN', overrideReason: '   ' }),
    ).toThrow(/Payment must be captured/);
  });

  it('never lets a non-admin override, even with a reason', () => {
    for (const actorRole of ['PROVIDER', 'CUSTOMER', 'BOTH'] as const) {
      expect(() =>
        assertPaymentSatisfied({ targetStatus: 'COMPLETED', paymentStatus: 'PENDING', actorRole, overrideReason: 'please' }),
      ).toThrow(/Payment must be captured/);
    }
  });

  it('refund transitions: CAPTURED -> REFUND_PENDING -> REFUNDED, and REFUND_PENDING -> CAPTURED on failure', () => {
    expect(() => validatePayment('CAPTURED', 'REFUND_PENDING', 'SYSTEM')).not.toThrow();
    expect(() => validatePayment('REFUND_PENDING', 'REFUNDED', 'SYSTEM')).not.toThrow();
    expect(() => validatePayment('REFUND_PENDING', 'CAPTURED', 'SYSTEM')).not.toThrow();
    expect(() => validatePayment('REFUND_PENDING', 'RELEASED', 'ADMIN')).toThrow();
    expect(() => validatePayment('PENDING', 'REFUND_PENDING', 'ADMIN')).toThrow();
    expect(() => validatePayment('CAPTURED', 'REFUND_PENDING', 'CUSTOMER')).toThrow();
  });
});
