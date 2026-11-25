import {
  CreateQuotationSchema,
  CreateQuotationInput,
  QuotationFieldsSchema,
} from '@weyro/validation';

export class CreateQuotationDto implements CreateQuotationInput {
  static readonly schema = CreateQuotationSchema;

  partsCost!: number;
  labourCost!: number;
  shippingCost?: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  warrantyDays!: number;
  etaDescription?: string;
  startsAt?: string;
  durationHours?: number;
  deliveryMethod?:
    | 'PICKUP'
    | 'DOORSTEP_DELIVERY'
    | 'PARTS_COURIER'
    | 'ON_SITE_FITMENT';
  notes?: string;
}

const UpdateQuotationSchema = QuotationFieldsSchema.partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })
  .refine((q) => (q.startsAt === undefined) === (q.durationHours === undefined), {
    message: 'Send both startsAt and durationHours, or neither',
    path: ['durationHours'],
  });

export class UpdateQuotationDto {
  static readonly schema = UpdateQuotationSchema;

  partsCost?: number;
  labourCost?: number;
  shippingCost?: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  warrantyDays?: number;
  etaDescription?: string;
  startsAt?: string;
  durationHours?: number;
  deliveryMethod?:
    | 'PICKUP'
    | 'DOORSTEP_DELIVERY'
    | 'PARTS_COURIER'
    | 'ON_SITE_FITMENT';
  notes?: string;
}
