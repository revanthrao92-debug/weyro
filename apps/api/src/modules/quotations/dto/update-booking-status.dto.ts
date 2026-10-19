import {
  UpdateBookingStatusSchema,
  UpdateBookingStatusInput,
} from '@weyro/validation';

export class UpdateBookingStatusDto implements UpdateBookingStatusInput {
  static readonly schema = UpdateBookingStatusSchema;

  status!:
    | 'CONFIRMED'
    | 'PROVIDER_EN_ROUTE'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED';
  trackingNumber?: string;
  carrierName?: string;
  completionNotes?: string;
}
