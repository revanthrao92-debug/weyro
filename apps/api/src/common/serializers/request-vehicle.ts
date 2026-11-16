/**
 * C4: a service request carries its vehicle either as a saved `Vehicle`
 * (vehicleId) or as free-form make/model/year columns on the request itself.
 * Every serializer goes through this helper so clients see the same shape
 * regardless of which source the request used.
 */
export interface RequestVehicleSource {
  vehicle?: {
    id?: string;
    make: string;
    model: string;
    year: number;
    registrationNumber?: string;
    fuelType?: string | null;
    transmission?: string | null;
    color?: string | null;
  } | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
}

export interface ResolvedRequestVehicle {
  id: string | null;
  make: string;
  model: string;
  year: number | null;
  registrationNumber?: string | null;
  fuelType: string | null;
  transmission: string | null;
  color: string | null;
}

export function resolveRequestVehicle(
  request: RequestVehicleSource | null | undefined,
): ResolvedRequestVehicle | null {
  if (!request) return null;
  if (request.vehicle) {
    return {
      ...request.vehicle,
      id: request.vehicle.id ?? null,
      fuelType: request.vehicle.fuelType ?? null,
      transmission: request.vehicle.transmission ?? null,
      color: request.vehicle.color ?? null,
    } as ResolvedRequestVehicle;
  }
  if (request.vehicleMake || request.vehicleModel) {
    return {
      id: null,
      make: request.vehicleMake ?? '',
      model: request.vehicleModel ?? '',
      year: request.vehicleYear ?? null,
      fuelType: null,
      transmission: null,
      color: null,
    };
  }
  return null;
}
