export class CreateDamageRequestDto {
  customerId: string;
  vehicleId: string;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  urgency?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  damagePhotos: string[];
  isBroadcast?: boolean;
  fulfillmentType?: 'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE';
  expiresInDays?: number;
}
