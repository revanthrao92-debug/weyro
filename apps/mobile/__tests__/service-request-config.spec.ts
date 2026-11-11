/* global describe, it, expect */
/**
 * Service-specific request flows — field sets, validation and the mapping into
 * the existing CreateServiceRequest contract.
 */
import {
  SERVICE_CONFIGS,
  addDaysISO,
  buildPayload,
  composeDescription,
  composeTitle,
  initialValues,
  initialUrgency,
  validateDraft,
  type DraftContext,
  type DraftValues,
  type ServiceCategory,
} from '../src/components/requests/serviceRequestConfig';
import type { Vehicle } from '../src/hooks/useProfile';
import type { PickedLocation } from '../src/maps';

const HOME: PickedLocation = {
  address: '12th Main Road, Indiranagar, Bengaluru',
  latitude: 12.9784,
  longitude: 77.6408,
  label: 'Home',
};

const KORAMANGALA: PickedLocation = {
  address: 'Koramangala 5th Block, Bengaluru',
  latitude: 12.9352,
  longitude: 77.6245,
  label: 'Office',
};

const VEHICLE: Vehicle = {
  id: 'vehicle-1',
  customerId: 'customer-1',
  make: 'Hyundai',
  model: 'Creta',
  year: 2022,
  registrationNumber: 'KA01AB1234',
  fuelType: 'PETROL',
  createdAt: '2026-01-01T00:00:00Z',
};

function context(
  values: DraftValues,
  overrides: Partial<DraftContext> = {},
): DraftContext {
  return {
    values,
    urgency: 'NORMAL',
    location: null,
    dropoff: null,
    savedLocation: HOME,
    selectedVehicle: VEHICLE,
    manualVehicle: { make: '', model: '', year: '' },
    spareFulfillment: 'PICKUP',
    photoCount: 0,
    isBroadcast: true,
    ...overrides,
  };
}

const validValues: Record<ServiceCategory, DraftValues> = {
  REPAIR: {
    damageType: 'Dent',
    affectedArea: 'Front bumper',
    issue: 'Deep dent on the front bumper after a parking knock.',
    drivable: 'No',
  },
  MAINTENANCE: {
    serviceType: 'Full service',
    odometer: '42500',
    preferredDate: addDaysISO(2),
  },
  SPARE_PART: {
    partName: 'Front brake pads',
    partNumber: '04465-0K290',
    quantity: '2',
    condition: 'New (OEM)',
    fitment: '1.5 diesel, 2022 facelift',
  },
  TOWING: {
    vehicleCondition: "Won't start",
    towingType: 'FLATBED',
    pickupTime: 'Now',
    emergency: 'No',
  },
  ROADSIDE: {
    assistanceType: 'Battery',
    issue: 'Battery is flat and the car will not start.',
  },
  INSPECTION: {
    inspectionType: 'Pre-purchase',
    preferredDate: addDaysISO(3),
    preferredTime: 'Morning (9–12)',
  },
};

const explicitLocation: Partial<Record<ServiceCategory, Partial<DraftContext>>> = {
  TOWING: { location: HOME, dropoff: KORAMANGALA },
  ROADSIDE: { location: HOME },
  INSPECTION: { location: HOME },
};

describe('service field configuration', () => {
  it('gives each service only its own fields', () => {
    expect(SERVICE_CONFIGS.REPAIR.fields.map((f) => f.key)).toEqual([
      'damageType',
      'affectedArea',
      'issue',
      'drivable',
    ]);
    expect(SERVICE_CONFIGS.MAINTENANCE.fields.map((f) => f.key)).toEqual([
      'serviceType',
      'odometer',
      'lastServiceDate',
      'preferredDate',
      'notes',
    ]);
    expect(SERVICE_CONFIGS.SPARE_PART.fields.map((f) => f.key)).toEqual([
      'partName',
      'partNumber',
      'quantity',
      'condition',
      'fitment',
    ]);
    expect(SERVICE_CONFIGS.TOWING.fields.map((f) => f.key)).toEqual([
      'vehicleCondition',
      'towingType',
      'pickupTime',
      'emergency',
    ]);
    expect(SERVICE_CONFIGS.ROADSIDE.fields.map((f) => f.key)).toEqual([
      'assistanceType',
      'issue',
    ]);
    expect(SERVICE_CONFIGS.INSPECTION.fields.map((f) => f.key)).toEqual([
      'inspectionType',
      'preferredDate',
      'preferredTime',
      'notes',
    ]);
  });

  it('only offers photos where the service needs them', () => {
    expect(SERVICE_CONFIGS.REPAIR.photos?.max).toBe(4);
    expect(SERVICE_CONFIGS.SPARE_PART.photos?.max).toBe(4);
    expect(SERVICE_CONFIGS.MAINTENANCE.photos).toBeUndefined();
    expect(SERVICE_CONFIGS.TOWING.photos).toBeUndefined();
    expect(SERVICE_CONFIGS.ROADSIDE.photos).toBeUndefined();
    expect(SERVICE_CONFIGS.INSPECTION.photos).toBeUndefined();
  });

  it('uses the right location modes', () => {
    expect(SERVICE_CONFIGS.REPAIR.locationMode).toBe('optional');
    expect(SERVICE_CONFIGS.MAINTENANCE.locationMode).toBe('optional');
    expect(SERVICE_CONFIGS.SPARE_PART.locationMode).toBe('spare');
    expect(SERVICE_CONFIGS.TOWING.locationMode).toBe('trip');
    expect(SERVICE_CONFIGS.ROADSIDE.requiresExplicitLocation).toBe(true);
    expect(SERVICE_CONFIGS.INSPECTION.requiresExplicitLocation).toBe(true);
  });
});

describe('validation', () => {
  it.each(Object.keys(SERVICE_CONFIGS) as ServiceCategory[])(
    'accepts a complete %s request',
    (category) => {
      const config = SERVICE_CONFIGS[category];
      const ctx = context(validValues[category], explicitLocation[category]);
      expect(validateDraft(config, ctx).errors).toEqual({});
    },
  );

  it('rejects missing service-specific fields', () => {
    const config = SERVICE_CONFIGS.REPAIR;
    const ctx = context({});
    const { errors } = validateDraft(config, ctx);
    expect(errors.damageType).toBeDefined();
    expect(errors.affectedArea).toBeDefined();
    expect(errors.issue).toBeDefined();
    expect(errors.drivable).toBeDefined();
  });

  it('keeps towing and roadside location confirmation mandatory', () => {
    const towing = validateDraft(
      SERVICE_CONFIGS.TOWING,
      context(validValues.TOWING, { savedLocation: HOME }),
    );
    expect(towing.errors.location).toBeDefined();

    const roadside = validateDraft(
      SERVICE_CONFIGS.ROADSIDE,
      context(validValues.ROADSIDE, { savedLocation: HOME }),
    );
    expect(roadside.errors.location).toBeDefined();
  });

  it('requires a distinct towing destination', () => {
    const same = validateDraft(
      SERVICE_CONFIGS.TOWING,
      context(validValues.TOWING, { location: HOME, dropoff: { ...HOME } }),
    );
    expect(same.errors.dropoff).toContain('same place');

    const missing = validateDraft(
      SERVICE_CONFIGS.TOWING,
      context(validValues.TOWING, { location: HOME }),
    );
    expect(missing.errors.dropoff).toBeDefined();
  });

  it('validates odometer and future appointment dates', () => {
    const ctx = context({
      ...validValues.MAINTENANCE,
      odometer: '-2',
      preferredDate: '2020-01-01',
    });
    const { errors } = validateDraft(SERVICE_CONFIGS.MAINTENANCE, ctx);
    expect(errors.odometer).toBeDefined();
    expect(errors.preferredDate).toBeDefined();
  });

  it('validates manual vehicle details when no saved vehicle is selected', () => {
    const ctx = context(validValues.REPAIR, {
      selectedVehicle: null,
      manualVehicle: { make: 'Maruti', model: '', year: '2021' },
    });
    const { errors } = validateDraft(SERVICE_CONFIGS.REPAIR, ctx);
    expect(errors.manualModel).toBeDefined();
    expect(errors.vehicle).toBeUndefined();
  });

  it('allows a complete manual vehicle', () => {
    const ctx = context(validValues.REPAIR, {
      selectedVehicle: null,
      manualVehicle: { make: 'Maruti', model: 'Swift', year: '2021' },
    });
    expect(validateDraft(SERVICE_CONFIGS.REPAIR, ctx).errors).toEqual({});
  });
});

describe('submission mapping', () => {
  it.each(Object.keys(SERVICE_CONFIGS) as ServiceCategory[])(
    'maps %s to the existing request contract',
    (category) => {
      const config = SERVICE_CONFIGS[category];
      const ctx = context(validValues[category], explicitLocation[category]);
      const payload = buildPayload(config, ctx, {
        photos: ['https://files.example/photo.jpg'],
        isBroadcast: true,
      });

      expect(payload.category).toBe(category);
      expect(payload.title.length).toBeGreaterThan(2);
      expect(payload.title.length).toBeLessThanOrEqual(150);
      expect(payload.description.length).toBeGreaterThan(5);
      expect(payload.description.length).toBeLessThanOrEqual(2000);
      expect(payload.address).toBeTruthy();
      expect(payload.latitude).toEqual(expect.any(Number));
      expect(payload.longitude).toEqual(expect.any(Number));
      expect(payload.vehicleId).toBe('vehicle-1');
      expect(payload.isBroadcast).toBe(true);
      expect(payload.damagePhotos).toEqual([
        'https://files.example/photo.jpg',
      ]);
    },
  );

  it('sends towing dropoff, equipment and garage fulfilment', () => {
    const ctx = context(validValues.TOWING, {
      location: HOME,
      dropoff: KORAMANGALA,
      urgency: 'EMERGENCY',
    });
    const payload = buildPayload(SERVICE_CONFIGS.TOWING, ctx, {
      photos: [],
      isBroadcast: false,
    });
    expect(payload.fulfillmentType).toBe('TOW_TO_GARAGE');
    expect(payload.dropoffAddress).toBe(KORAMANGALA.address);
    expect(payload.dropoffLatitude).toBe(KORAMANGALA.latitude);
    expect(payload.dropoffLongitude).toBe(KORAMANGALA.longitude);
    expect(payload.towingVehicleType).toBe('FLATBED');
    expect(payload.urgency).toBe('EMERGENCY');
  });

  it('maps spare parts delivery vs pickup', () => {
    const delivery = buildPayload(
      SERVICE_CONFIGS.SPARE_PART,
      context(validValues.SPARE_PART, {
        location: KORAMANGALA,
        spareFulfillment: 'DELIVERY',
      }),
      { photos: [], isBroadcast: true },
    );
    expect(delivery.fulfillmentType).toBe('PARTS_SHIPPING');
    expect(delivery.address).toBe(KORAMANGALA.address);

    const pickup = buildPayload(
      SERVICE_CONFIGS.SPARE_PART,
      context(validValues.SPARE_PART, { spareFulfillment: 'PICKUP' }),
      { photos: [], isBroadcast: true },
    );
    expect(pickup.fulfillmentType).toBe('WORKSHOP_VISIT');
    expect(pickup.address).toBe(HOME.address);
  });

  it('maps supported roadside kinds and leaves lockout untyped', () => {
    const battery = buildPayload(
      SERVICE_CONFIGS.ROADSIDE,
      context(validValues.ROADSIDE, { location: HOME, urgency: 'URGENT' }),
      { photos: [], isBroadcast: true },
    );
    expect(battery.roadsideKind).toBe('BATTERY');
    expect(battery.fulfillmentType).toBe('ON_SITE');

    const lockout = buildPayload(
      SERVICE_CONFIGS.ROADSIDE,
      context(
        { assistanceType: 'Lockout', issue: 'Keys are locked inside the car.' },
        { location: HOME },
      ),
      { photos: [], isBroadcast: true },
    );
    expect(lockout.roadsideKind).toBeUndefined();
    expect(lockout.description).toContain('Lockout');
  });

  it('falls back to manual vehicle fields when no saved vehicle is selected', () => {
    const payload = buildPayload(
      SERVICE_CONFIGS.REPAIR,
      context(validValues.REPAIR, {
        selectedVehicle: null,
        manualVehicle: { make: 'Maruti', model: 'Swift', year: '2021' },
      }),
      { photos: [], isBroadcast: true },
    );
    expect(payload.vehicleId).toBeUndefined();
    expect(payload.vehicleMake).toBe('Maruti');
    expect(payload.vehicleModel).toBe('Swift');
    expect(payload.vehicleYear).toBe(2021);
  });

  it('never sends untyped/extra fields beyond the contract', () => {
    const payload = buildPayload(
      SERVICE_CONFIGS.INSPECTION,
      context(validValues.INSPECTION, { location: HOME }),
      { photos: [], isBroadcast: true },
    );
    const allowed = new Set([
      'vehicleId',
      'vehicleMake',
      'vehicleModel',
      'vehicleYear',
      'category',
      'title',
      'description',
      'address',
      'latitude',
      'longitude',
      'urgency',
      'mediaUrls',
      'damagePhotos',
      'isBroadcast',
      'fulfillmentType',
      'dropoffAddress',
      'dropoffLatitude',
      'dropoffLongitude',
      'towingVehicleType',
      'roadsideKind',
      'vehicleWeightKg',
      'expiresInDays',
    ]);
    Object.keys(payload).forEach((key) => expect(allowed.has(key)).toBe(true));
  });
});

describe('composition and prefills', () => {
  it('builds useful titles and readable descriptions', () => {
    const ctx = context(validValues.REPAIR);
    expect(composeTitle(SERVICE_CONFIGS.REPAIR, ctx)).toBe(
      'Front bumper dent',
    );
    const description = composeDescription(SERVICE_CONFIGS.REPAIR, ctx);
    expect(description).toContain('Damage type: Dent');
    expect(description).toContain('Affected area: Front bumper');
    expect(description).toContain('Drivable: No');
  });

  it('formats dates, numbers and quantities for providers', () => {
    const maintenance = context({
      ...validValues.MAINTENANCE,
      odometer: '42500',
      preferredDate: '2026-12-01',
    });
    const description = composeDescription(
      SERVICE_CONFIGS.MAINTENANCE,
      maintenance,
    );
    expect(description).toContain('42,500 km');
    expect(description).toContain('1 Dec 2026');

    const spare = context({ ...validValues.SPARE_PART, quantity: '2' });
    expect(composeTitle(SERVICE_CONFIGS.SPARE_PART, spare)).toBe(
      'Front brake pads ×2',
    );
  });

  it('prefills SOS and package entry points', () => {
    expect(
      initialValues(SERVICE_CONFIGS.ROADSIDE, 'Battery jumpstart', 'EMERGENCY'),
    ).toMatchObject({ assistanceType: 'Battery' });
    expect(
      initialValues(SERVICE_CONFIGS.TOWING, 'Wheel-lift tow', 'EMERGENCY'),
    ).toMatchObject({ towingType: 'HOOK_AND_CHAIN', emergency: 'Yes' });
    expect(
      initialValues(SERVICE_CONFIGS.MAINTENANCE, 'AC service'),
    ).toMatchObject({ serviceType: 'AC service' });
    expect(
      initialValues(SERVICE_CONFIGS.INSPECTION, 'Pre-purchase check'),
    ).toMatchObject({ inspectionType: 'Pre-purchase' });
    expect(
      initialValues(SERVICE_CONFIGS.SPARE_PART, 'Brake pads'),
    ).toMatchObject({ partName: 'Brake pads', quantity: '1' });
    expect(initialUrgency(SERVICE_CONFIGS.ROADSIDE)).toBe('URGENT');
  });
});
