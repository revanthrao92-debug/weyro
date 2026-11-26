import { nextTripStep, vehicleLabel } from '../src/components/driver/driverFormat';

describe('nextTripStep', () => {
  it('walks a trip forward; start (needs code) and end (confirm) open the trip', () => {
    expect(nextTripStep('CONFIRMED')).toEqual({ title: 'On my way', next: 'DRIVER_EN_ROUTE' });
    expect(nextTripStep('DRIVER_EN_ROUTE')).toEqual({ title: 'I have arrived', next: 'ARRIVED' });
    expect(nextTripStep('ARRIVED')).toEqual({ title: 'Start trip' });
    expect(nextTripStep('IN_PROGRESS')).toEqual({ title: 'End trip' });
  });
  it('requests and finished trips have no step button', () => {
    for (const s of ['REQUESTED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'] as const) expect(nextTripStep(s)).toBeNull();
  });
  it('vehicle reads with a comma, not a dot', () => {
    expect(vehicleLabel({ vehicle: { make: 'Hyundai', model: 'Creta', registrationNumber: 'TS09DG0002' } } as any)).toBe(
      'Hyundai Creta, TS09DG0002',
    );
  });
});
