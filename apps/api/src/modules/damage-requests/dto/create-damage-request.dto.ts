export class CreateDamageRequestDto {
  vehicleId!: string;
  title!: string;
  description!: string;
  address!: string;
  latitude!: number;
  longitude!: number;
  category?:
    | 'REPAIR'
    | 'MAINTENANCE'
    | 'SPARE_PART'
    | 'TOWING'
    | 'ROADSIDE'
    | 'INSPECTION';
  urgency?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  damagePhotos?: string[];
  isBroadcast?: boolean;
  fulfillmentType?:
    | 'ON_SITE'
    | 'WORKSHOP_VISIT'
    | 'PARTS_SHIPPING'
    | 'TOW_TO_GARAGE';
  expiresInDays?: number;
}
