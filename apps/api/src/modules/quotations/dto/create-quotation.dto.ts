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
