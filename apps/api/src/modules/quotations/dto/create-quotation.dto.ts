import {
  CreateQuotationSchema,
  CreateQuotationInput,
} from '@weyro/validation';

export class CreateQuotationDto implements CreateQuotationInput {
  static readonly schema = CreateQuotationSchema;

  partsCost!: number;
  labourCost!: number;
  shippingCost?: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  warrantyDays!: number;
  etaDescription!: string;
  deliveryMethod?:
    | 'PICKUP'
    | 'DOORSTEP_DELIVERY'
    | 'PARTS_COURIER'
    | 'ON_SITE_FITMENT';
  notes?: string;
}

const UpdateQuotationSchema = CreateQuotationSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required' },
);

export class UpdateQuotationDto {
  static readonly schema = UpdateQuotationSchema;

  partsCost?: number;
  labourCost?: number;
  shippingCost?: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  warrantyDays?: number;
  etaDescription?: string;
  deliveryMethod?:
    | 'PICKUP'
    | 'DOORSTEP_DELIVERY'
    | 'PARTS_COURIER'
    | 'ON_SITE_FITMENT';
  notes?: string;
}
