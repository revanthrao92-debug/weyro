export class CreateQuotationDto {
  providerId: string;
  providerName?: string;
  providerType?: 'MECHANIC' | 'GARAGE' | 'PARTS_DEALER';
  partsCost: number;
  labourCost?: number;
  shippingCost?: number;
  totalCost: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  warrantyDays?: number;
  etaDescription: string;
  deliveryMethod?: string;
  notes?: string;
}
