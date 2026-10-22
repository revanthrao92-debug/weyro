import {
  UpdateBookingLocationSchema,
  UpdateBookingLocationInput,
} from '@weyro/validation';

export class UpdateBookingLocationDto implements UpdateBookingLocationInput {
  static readonly schema = UpdateBookingLocationSchema;

  latitude!: number;
  longitude!: number;
  etaMinutes?: number;
}
