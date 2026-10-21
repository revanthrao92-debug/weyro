import {
  ReleasePaymentSchema,
  ReleasePaymentInput,
} from '@weyro/validation';

export class ReleasePaymentDto implements ReleasePaymentInput {
  static readonly schema = ReleasePaymentSchema;

  bookingId!: string;
  payoutReference!: string;
  notes?: string;
}
