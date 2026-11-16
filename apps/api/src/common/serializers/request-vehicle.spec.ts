import { resolveRequestVehicle } from './request-vehicle';

describe('resolveRequestVehicle (C4)', () => {
  it('prefers the saved vehicle', () => {
    const v = resolveRequestVehicle({
      vehicle: { id: 'v1', make: 'Honda', model: 'City', year: 2019, fuelType: 'PETROL' },
      vehicleMake: 'Ignored',
    });
    expect(v).toMatchObject({ id: 'v1', make: 'Honda', model: 'City', year: 2019, fuelType: 'PETROL' });
  });

  it('falls back to the request free-form columns', () => {
    expect(
      resolveRequestVehicle({ vehicle: null, vehicleMake: 'Maruti', vehicleModel: 'Swift', vehicleYear: 2021 }),
    ).toEqual({ id: null, make: 'Maruti', model: 'Swift', year: 2021, fuelType: null, transmission: null, color: null });
  });

  it('is null when neither source has data', () => {
    expect(resolveRequestVehicle({ vehicle: null })).toBeNull();
    expect(resolveRequestVehicle(null)).toBeNull();
  });
});
