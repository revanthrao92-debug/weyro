import {
  toPaymentSummary,
  toPublicCustomer,
  toPublicProvider,
} from '../../common/serializers/public-provider';
import { resolveRequestVehicle } from '../../common/serializers/request-vehicle';

/**
 * Cross-party booking payloads must never carry the other party's phone,
 * exact address, KYC documents or gateway internals. Admins keep the full
 * record for reconciliation.
 */
export function serializeBooking(booking: any, role: string) {
  if (role === 'ADMIN') {
    return booking;
  }

  const {
    customer,
    provider,
    payments,
    ...rest
  } = booking;

  const vehicle = resolveRequestVehicle(booking.quotation?.request);
  const safeVehicle = vehicle
    ? {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        color: vehicle.color,
      }
    : vehicle ?? null;

  return {
    ...rest,
    ...(booking.quotation?.request
      ? {
          quotation: {
            ...booking.quotation,
            request: {
              ...booking.quotation.request,
              vehicle: safeVehicle,
            },
          },
        }
      : {}),
    customer: customer ? toPublicCustomer(customer) : null,
    provider: provider ? toPublicProvider(provider) : null,
    payments: (payments ?? []).map(toPaymentSummary),
  };
}

