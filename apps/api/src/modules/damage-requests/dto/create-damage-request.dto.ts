import {
  CreateServiceRequestSchema,
  CreateServiceRequestInput,
} from '@weyro/validation';

export class CreateDamageRequestDto implements CreateServiceRequestInput {
  static readonly schema = CreateServiceRequestSchema;

  vehicleId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  category!:
    | 'REPAIR'
    | 'MAINTENANCE'
    | 'SPARE_PART'
    | 'TOWING'
    | 'ROADSIDE'
    | 'INSPECTION'
    | 'MECHANICAL'
    | 'BODYWORK';
  title!: string;
  description!: string;
  address!: string;
  latitude!: number;
  longitude!: number;
  urgency!: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  mediaUrls!: string[];
  damagePhotos!: string[];
  isBroadcast!: boolean;
  fulfillmentType?:
    | 'ON_SITE'
    | 'WORKSHOP_VISIT'
    | 'PARTS_SHIPPING'
    | 'TOW_TO_GARAGE';
  expiresInDays?: number;
}
