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

    it('rejects illegal transition from FAILED to CAPTURED', () => {
      expect(() =>
        validatePaymentTransition('FAILED', 'CAPTURED', 'SYSTEM'),
      ).toThrow(ConflictException);
    });
  });
});
