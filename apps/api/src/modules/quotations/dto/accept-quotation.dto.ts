import {
  AcceptQuotationSchema,
  AcceptQuotationInput,
} from '@weyro/validation';

export class AcceptQuotationDto implements AcceptQuotationInput {
  static readonly schema = AcceptQuotationSchema;

  scheduledDate?: string;
  deliveryAddress?: string;
  notes?: string;
}
