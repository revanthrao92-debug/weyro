export class CreateQuotationDto {
  partsCost!: number;
  labourCost?: number;
  shippingCost?: number;
  totalCost?: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  warrantyDays?: number;
  etaDescription!: string;
  deliveryMethod?:
    | 'PICKUP'
    | 'DOORSTEP_DELIVERY'
    | 'PARTS_COURIER'
    | 'ON_SITE_FITMENT';
  notes?: string;
}
