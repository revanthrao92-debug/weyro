import type { CreateServiceRequest } from '@/hooks/useRequests';
import type { PickedLocation } from '@/maps/types';
import { haversineMeters } from '@/maps/geo';
import type { Vehicle } from '@/hooks/useProfile';

export type ServiceCategory =
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'SPARE_PART'
  | 'TOWING'
  | 'ROADSIDE'
  | 'INSPECTION';

export type Urgency = 'NORMAL' | 'URGENT' | 'EMERGENCY';
export type DraftValues = Record<string, string>;
export type SpareFulfillment = 'PICKUP' | 'DELIVERY';

export type ManualVehicle = { make: string; model: string; year: string };

export type FieldOption = { value: string; label: string };

export type FieldConfig = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'chips' | 'date';
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  unit?: string;
  /** Label used in the provider-facing description (defaults to label). */
  descriptionLabel?: string;
  /** Date must not be before today. */
  future?: boolean;
  /** Date must not be after today. */
  past?: boolean;
};

export type DraftContext = {
  values: DraftValues;
  urgency: Urgency;
  /** Explicitly chosen points. Saved addresses are applied by the helpers. */
  location: PickedLocation | null;
  dropoff: PickedLocation | null;
  savedLocation: PickedLocation | null;
  selectedVehicle: Vehicle | null;
  manualVehicle: ManualVehicle;
  spareFulfillment: SpareFulfillment;
  photoCount: number;
  isBroadcast: boolean;
};

export type PhotoConfig = {
  label: string;
  help: string;
  max: number;
};

export type ServiceConfig = {
  category: ServiceCategory;
  label: string;
  detail: string;
  title: string;
  subtitle: string;
  detailsTitle: string;
  fields: FieldConfig[];
  photos?: PhotoConfig;
  locationMode: 'optional' | 'required' | 'trip' | 'spare';
  /** Show location: saved addresses do not satisfy these services. */
  requiresExplicitLocation?: boolean;
  locationLabel: string;
  locationHelp: string;
  locationError: string;
  urgencyMode: 'none' | 'select' | 'emergency';
  defaults?: DraftValues;
  titleFor: (ctx: DraftContext) => string;
  extraDescription?: (ctx: DraftContext) => string[];
  prefill?: (title: string) => DraftValues;
};

export type RequestErrorMap = Record<string, string>;

const DAMAGE_TYPES = [
  'Dent',
  'Scratch',
  'Crack',
  'Broken part',
  'Paint damage',
  'Other',
];

const AREAS = [
  'Front bumper',
  'Rear bumper',
  'Bonnet',
  'Door',
  'Fender',
  'Roof',
  'Windscreen',
  'Interior',
  'Underside',
  'Other',
];

const yesNo = (yes = 'Yes', no = 'No'): FieldOption[] => [
  { value: yes, label: yes },
  { value: no, label: no },
];

export const ROADSIDE_KIND_MAP: Record<
  string,
  'BATTERY' | 'TYRE' | 'FUEL' | undefined
> = {
  Battery: 'BATTERY',
  'Flat tyre': 'TYRE',
  'Out of fuel': 'FUEL',
  Lockout: undefined,
  Other: undefined,
};

const SERVICE_LIST: ServiceConfig[] = [
  {
    category: 'REPAIR',
    label: 'Repair',
    detail: 'Bodywork, dents, paint',
    title: 'Report damage',
    subtitle: 'Tell us what happened. Verified garages nearby send quotes.',
    detailsTitle: 'Damage',
    fields: [
      {
        key: 'damageType',
        label: 'Damage type',
        type: 'chips',
        required: true,
        options: DAMAGE_TYPES.map((value) => ({ value, label: value })),
      },
      {
        key: 'affectedArea',
        label: 'Affected area',
        type: 'chips',
        required: true,
        options: AREAS.map((value) => ({ value, label: value })),
      },
      {
        key: 'issue',
        label: 'Describe the issue',
        type: 'textarea',
        required: true,
        minLength: 10,
        maxLength: 600,
        placeholder: 'What happened, and what needs fixing?',
      },
      {
        key: 'drivable',
        label: 'Is the vehicle drivable?',
        descriptionLabel: 'Drivable',
        type: 'chips',
        required: true,
        options: yesNo().concat([{ value: 'Not sure', label: 'Not sure' }]),
      },
    ],
    photos: {
      label: 'Photos of the damage',
      help: 'Up to 4 photos. Clear, well-lit shots get accurate quotes.',
      max: 4,
    },
    locationMode: 'optional',
    locationLabel: 'Vehicle location',
    locationHelp: 'Saved address is used unless you change it.',
    locationError: 'Add the vehicle location so garages can reach you.',
    urgencyMode: 'none',
    titleFor: (ctx) => {
      const area = ctx.values.affectedArea;
      const damage = ctx.values.damageType;
      if (!area || !damage) return 'Repair request';
      const subject = area === 'Other' ? 'Vehicle' : area;
      return damage === 'Other'
        ? `${subject} damage`
        : `${subject} ${damage.toLowerCase()}`;
    },
    prefill: (title) => ({ issue: title }),
  },
  {
    category: 'MAINTENANCE',
    label: 'Maintenance',
    detail: 'Oil, filters, scheduled service',
    title: 'Book maintenance',
    subtitle: 'Tell us what the vehicle needs. Garages send service quotes.',
    detailsTitle: 'Service',
    fields: [
      {
        key: 'serviceType',
        label: 'Service type',
        descriptionLabel: 'Service',
        type: 'chips',
        required: true,
        options: [
          { value: 'Oil & filter', label: 'Oil & filter' },
          { value: 'Full service', label: 'Full service' },
          { value: 'Brakes', label: 'Brakes' },
          { value: 'Tyres', label: 'Tyres' },
          { value: 'AC service', label: 'AC service' },
          { value: 'Suspension', label: 'Suspension' },
          { value: 'Diagnostics', label: 'Diagnostics' },
          { value: 'Other', label: 'Other' },
        ],
      },
      {
        key: 'odometer',
        label: 'Current odometer',
        descriptionLabel: 'Odometer',
        type: 'number',
        required: true,
        min: 0,
        max: 1000000,
        unit: 'km',
        placeholder: 'e.g. 42500',
        help: 'Kilometres on the clock.',
      },
      {
        key: 'lastServiceDate',
        label: 'Last service date',
        descriptionLabel: 'Last service',
        type: 'date',
        past: true,
        help: 'Optional. Approximate is fine.',
      },
      {
        key: 'preferredDate',
        label: 'Preferred appointment',
        descriptionLabel: 'Preferred date',
        type: 'date',
        required: true,
        future: true,
        help: 'Garages confirm the exact slot.',
      },
      {
        key: 'notes',
        label: 'Additional requirements',
        type: 'textarea',
        maxLength: 600,
        placeholder: 'Anything else the garage should know?',
      },
    ],
    locationMode: 'optional',
    locationLabel: 'Service location',
    locationHelp: 'Garage visit or your address — saved address is used by default.',
    locationError: 'Add the service location so garages can plan the work.',
    urgencyMode: 'none',
    titleFor: (ctx) =>
      ctx.values.serviceType && ctx.values.serviceType !== 'Other'
        ? ctx.values.serviceType
        : 'Maintenance service',
    prefill: (title): DraftValues => {
      if (/standard/i.test(title)) return { serviceType: 'Full service' };
      if (/ac/i.test(title)) return { serviceType: 'AC service' };
      return { notes: title };
    },
  },
  {
    category: 'SPARE_PART',
    label: 'Spare parts',
    detail: 'Genuine and aftermarket',
    title: 'Request a part',
    subtitle: 'Describe the part. Dealers reply with price and availability.',
    detailsTitle: 'Part',
    fields: [
      {
        key: 'partName',
        label: 'Part name',
        descriptionLabel: 'Part',
        type: 'text',
        required: true,
        maxLength: 100,
        placeholder: 'e.g. Front brake pads',
      },
      {
        key: 'partNumber',
        label: 'Part / OEM number',
        descriptionLabel: 'Part number',
        type: 'text',
        maxLength: 60,
        help: 'Optional. Helps dealers quote the exact part.',
        placeholder: 'e.g. 04465-0K290',
      },
      {
        key: 'quantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        min: 1,
        max: 99,
        placeholder: '1',
      },
      {
        key: 'condition',
        label: 'New or used',
        descriptionLabel: 'Condition',
        type: 'chips',
        options: [
          { value: 'New (OEM)', label: 'New (OEM)' },
          { value: 'New (aftermarket)', label: 'New (aftermarket)' },
          { value: 'Used', label: 'Used' },
          { value: 'No preference', label: 'No preference' },
        ],
      },
      {
        key: 'fitment',
        label: 'Vehicle compatibility',
        descriptionLabel: 'Fitment',
        type: 'textarea',
        maxLength: 500,
        placeholder: 'Engine, variant or fitment notes (optional)',
      },
    ],
    photos: {
      label: 'Part photos',
      help: 'Up to 4 photos of the old part or the label.',
      max: 4,
    },
    locationMode: 'spare',
    locationLabel: 'Your location',
    locationHelp: 'Used only to show dealers how far the part must travel.',
    locationError: 'Add a location so dealers can judge the distance.',
    urgencyMode: 'none',
    defaults: { quantity: '1', condition: 'No preference' },
    titleFor: (ctx) => {
      const name = ctx.values.partName?.trim() || 'Spare part';
      const qty = Number(ctx.values.quantity || 1);
      return qty > 1 ? `${name} ×${qty}` : name;
    },
    extraDescription: (ctx) => {
      const lines = [
        `Fulfilment: ${ctx.spareFulfillment === 'DELIVERY' ? 'Delivery' : 'Dealer pickup'}`,
      ];
      if (ctx.spareFulfillment === 'DELIVERY') {
        const place = effectiveLocationFor(SERVICE_CONFIGS.SPARE_PART, ctx);
        if (place) lines.push(`Delivery address: ${place.address}`);
      }
      return lines;
    },
    prefill: (title) => ({ partName: title }),
  },
  {
    category: 'TOWING',
    label: 'Towing',
    detail: 'Flatbed, wheel-lift',
    title: 'Request a tow',
    subtitle: 'Set the pickup and destination so towers can quote the trip.',
    detailsTitle: 'Vehicle & equipment',
    fields: [
      {
        key: 'vehicleCondition',
        label: 'Vehicle condition',
        type: 'chips',
        required: true,
        options: [
          { value: 'Starts and drives', label: 'Starts and drives' },
          { value: "Starts but won't move", label: "Starts but won't move" },
          { value: "Won't start", label: "Won't start" },
          { value: 'Accident damage', label: 'Accident damage' },
          { value: 'Wheels locked', label: 'Wheels locked' },
        ],
      },
      {
        key: 'towingType',
        label: 'Towing equipment',
        descriptionLabel: 'Equipment',
        type: 'chips',
        required: true,
        options: [
          { value: 'FLATBED', label: 'Flatbed' },
          { value: 'HOOK_AND_CHAIN', label: 'Hook & chain / wheel-lift' },
          { value: 'MOTORCYCLE', label: 'Motorcycle' },
          { value: 'ANY', label: 'Any suitable' },
        ],
      },
      {
        key: 'pickupTime',
        label: 'Preferred pickup',
        descriptionLabel: 'Pickup time',
        type: 'chips',
        required: true,
        options: [
          { value: 'Now', label: 'Now' },
          { value: 'Within 1 hour', label: 'Within 1 hour' },
          { value: 'Today', label: 'Today' },
          { value: 'Tomorrow', label: 'Tomorrow' },
        ],
      },
      {
        key: 'emergency',
        label: 'Is this an emergency?',
        descriptionLabel: 'Emergency',
        type: 'chips',
        required: true,
        options: yesNo(),
      },
    ],
    locationMode: 'trip',
    requiresExplicitLocation: true,
    locationLabel: 'Pickup point',
    locationHelp: 'Where is the vehicle now? Drag the pin to fine-tune.',
    locationError: 'Confirm the pickup point.',
    urgencyMode: 'emergency',
    defaults: { emergency: 'No' },
    titleFor: (ctx) =>
      ctx.dropoff ? `Tow to ${shortPlace(ctx.dropoff)}` : 'Towing request',
    extraDescription: (ctx) => {
      const pickup = effectiveLocationFor(SERVICE_CONFIGS.TOWING, ctx);
      const lines: string[] = [];
      if (pickup) lines.push(`Pickup: ${pickup.address}`);
      if (ctx.dropoff) lines.push(`Destination: ${ctx.dropoff.address}`);
      return lines;
    },
    prefill: (title): DraftValues => {
      if (/wheel|hook/i.test(title)) return { towingType: 'HOOK_AND_CHAIN' };
      return {};
    },
  },
  {
    category: 'ROADSIDE',
    label: 'Roadside',
    detail: 'Battery, tyre, fuel',
    title: 'Roadside assistance',
    subtitle: 'Confirm where you are so the nearest help can reach you.',
    detailsTitle: 'Assistance',
    fields: [
      {
        key: 'assistanceType',
        label: 'What do you need?',
        descriptionLabel: 'Assistance',
        type: 'chips',
        required: true,
        options: [
          { value: 'Battery', label: 'Battery' },
          { value: 'Flat tyre', label: 'Flat tyre' },
          { value: 'Out of fuel', label: 'Out of fuel' },
          { value: 'Lockout', label: 'Lockout' },
          { value: 'Other', label: 'Other' },
        ],
      },
      {
        key: 'issue',
        label: 'Describe the problem',
        descriptionLabel: 'Problem',
        type: 'textarea',
        required: true,
        minLength: 10,
        maxLength: 600,
        placeholder: 'e.g. Battery is flat and the car will not start.',
      },
    ],
    locationMode: 'required',
    requiresExplicitLocation: true,
    locationLabel: 'Assistance location',
    locationHelp: 'Use your current location or drop a pin where help is needed.',
    locationError: 'Confirm where you need help.',
    urgencyMode: 'select',
    titleFor: (ctx) =>
      ctx.values.assistanceType
        ? `${ctx.values.assistanceType} assistance`
        : 'Roadside assistance',
    extraDescription: (ctx) => [
      `Urgency: ${urgencyLabel(ctx.urgency)}`,
    ],
    prefill: (title): DraftValues => {
      if (/battery/i.test(title)) return { assistanceType: 'Battery' };
      if (/tyre|tire/i.test(title)) return { assistanceType: 'Flat tyre' };
      if (/fuel/i.test(title)) return { assistanceType: 'Out of fuel' };
      return { issue: title };
    },
  },
  {
    category: 'INSPECTION',
    label: 'Inspection',
    detail: 'Pre-purchase, 200-point',
    title: 'Book an inspection',
    subtitle: 'Choose where and when the vehicle will be inspected.',
    detailsTitle: 'Inspection',
    fields: [
      {
        key: 'inspectionType',
        label: 'Inspection type',
        descriptionLabel: 'Inspection',
        type: 'chips',
        required: true,
        options: [
          { value: 'Pre-purchase', label: 'Pre-purchase' },
          { value: 'Insurance', label: 'Insurance' },
          { value: 'Post-repair', label: 'Post-repair' },
          { value: 'Roadworthy', label: 'Roadworthy' },
          { value: 'Diagnostics', label: 'Diagnostics' },
        ],
      },
      {
        key: 'preferredDate',
        label: 'Preferred date',
        type: 'date',
        required: true,
        future: true,
      },
      {
        key: 'preferredTime',
        label: 'Preferred time',
        type: 'chips',
        required: true,
        options: [
          { value: 'Morning (9–12)', label: 'Morning (9–12)' },
          { value: 'Afternoon (12–4)', label: 'Afternoon (12–4)' },
          { value: 'Evening (4–7)', label: 'Evening (4–7)' },
        ],
      },
      {
        key: 'notes',
        label: 'Additional requirements',
        type: 'textarea',
        maxLength: 600,
        placeholder: 'Anything the inspector should know?',
      },
    ],
    locationMode: 'required',
    requiresExplicitLocation: true,
    locationLabel: 'Inspection location',
    locationHelp: 'Where should the inspector meet the vehicle?',
    locationError: 'Confirm the inspection location.',
    urgencyMode: 'none',
    titleFor: (ctx) =>
      ctx.values.inspectionType
        ? `${ctx.values.inspectionType} inspection`
        : 'Vehicle inspection',
    prefill: (title): DraftValues => {
      if (/pre-purchase/i.test(title)) return { inspectionType: 'Pre-purchase' };
      return { notes: title };
    },
  },
];

export const SERVICE_CONFIGS = Object.fromEntries(
  SERVICE_LIST.map((config) => [config.category, config]),
) as Record<ServiceCategory, ServiceConfig>;

export const SERVICE_LIST_ORDER = SERVICE_LIST;

export function isServiceCategory(value: unknown): value is ServiceCategory {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SERVICE_CONFIGS, value)
  );
}

/** ---------------------------------------------------------------- dates */

const pad = (value: number) => String(value).padStart(2, '0');

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDaysISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function prettyDate(value: string): string {
  if (!isValidISODate(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** ------------------------------------------------------------- display */

export function displayFieldValue(
  field: FieldConfig,
  value: string | undefined,
): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (field.type === 'chips') {
    return field.options?.find((option) => option.value === raw)?.label ?? raw;
  }
  if (field.type === 'date') return prettyDate(raw);
  if (field.type === 'number') {
    const number = Number(raw);
    const formatted = Number.isFinite(number)
      ? number.toLocaleString('en-IN')
      : raw;
    return field.unit ? `${formatted} ${field.unit}` : formatted;
  }
  return raw;
}

export function urgencyLabel(urgency: Urgency): string {
  switch (urgency) {
    case 'EMERGENCY':
      return 'Emergency';
    case 'URGENT':
      return 'Urgent';
    default:
      return 'Normal';
  }
}

function shortPlace(place: PickedLocation): string {
  return place.label?.trim() || place.address.split(',')[0] || 'destination';
}

const clip = (value: string, max: number) =>
  value.length > max ? value.slice(0, max) : value;

/** ------------------------------------------------------------ validation */

export function validateField(
  field: FieldConfig,
  value: string | undefined,
): string | null {
  const raw = (value ?? '').trim();
  if (!raw) {
    return field.required ? `${field.label} is required.` : null;
  }

  if (field.type === 'chips') {
    const valid = field.options?.some((option) => option.value === raw);
    return valid === false ? `Choose ${field.label.toLowerCase()}.` : null;
  }

  if (field.type === 'number') {
    if (!/^\d+$/.test(raw)) return 'Use whole numbers only.';
    const number = Number(raw);
    if (field.min !== undefined && number < field.min) {
      return `Minimum ${field.min}.`;
    }
    if (field.max !== undefined && number > field.max) {
      return `Maximum ${field.max}.`;
    }
  }

  if (field.type === 'date') {
    if (!isValidISODate(raw)) return 'Use the format YYYY-MM-DD.';
    if (field.future && raw < todayISO()) return 'Choose today or a later date.';
    if (field.past && raw > todayISO()) return 'Choose today or an earlier date.';
  }

  if (field.minLength && raw.length < field.minLength) {
    return `Add at least ${field.minLength} characters.`;
  }
  if (field.maxLength && raw.length > field.maxLength) {
    return `Keep this under ${field.maxLength} characters.`;
  }
  return null;
}

export function errorStep(key: string): 1 | 2 {
  return ['vehicle', 'manualMake', 'manualModel', 'manualYear', 'location', 'dropoff', 'spareFulfillment'].includes(
    key,
  )
    ? 2
    : 1;
}

export function effectiveLocationFor(
  config: ServiceConfig,
  ctx: DraftContext,
): PickedLocation | null {
  if (config.locationMode === 'spare' && ctx.spareFulfillment === 'PICKUP') {
    return ctx.savedLocation ?? ctx.location;
  }
  if (config.requiresExplicitLocation) return ctx.location;
  return ctx.location ?? ctx.savedLocation;
}

export function validateDraft(
  config: ServiceConfig,
  ctx: DraftContext,
): { errors: RequestErrorMap; firstStep: 1 | 2 } {
  const errors: RequestErrorMap = {};

  config.fields.forEach((field) => {
    const message = validateField(field, ctx.values[field.key]);
    if (message) errors[field.key] = message;
  });

  // Vehicle: a saved vehicle, or complete manual details.
  if (!ctx.selectedVehicle) {
    const { make, model, year } = ctx.manualVehicle;
    const manualMissing = !make.trim() && !model.trim() && !year.trim();
    if (manualMissing) {
      errors.vehicle = 'Choose a saved vehicle or enter its details.';
    } else {
      if (!make.trim()) errors.manualMake = 'Make is required.';
      if (!model.trim()) errors.manualModel = 'Model is required.';
      if (!year.trim()) {
        errors.manualYear = 'Year is required.';
      } else {
        const numericYear = Number(year);
        const maxYear = new Date().getFullYear() + 1;
        if (
          !/^\d{4}$/.test(year) ||
          numericYear < 1980 ||
          numericYear > maxYear
        ) {
          errors.manualYear = `Enter a year between 1980 and ${maxYear}.`;
        }
      }
      if (!errors.manualMake && !errors.manualModel && !errors.manualYear) {
        // Complete manual vehicle — valid.
      }
    }
  }

  const pickup = effectiveLocationFor(config, ctx);
  if (!pickup) errors.location = config.locationError;

  if (config.locationMode === 'trip') {
    if (!ctx.dropoff) {
      errors.dropoff = 'Add the destination.';
    } else if (pickup && haversineMeters(pickup, ctx.dropoff) < 50) {
      errors.dropoff = 'Pickup and destination look like the same place.';
    }
  }

  const description = composeDescription(config, ctx);
  if (description.length > 2000) {
    errors.description = 'Details are too long — shorten the notes.';
  }

  const firstStep = Object.keys(errors).some((key) => errorStep(key) === 1)
    ? 1
    : 2;
  return { errors, firstStep };
}

/** ------------------------------------------------------------- compose */

export function composeDescription(
  config: ServiceConfig,
  ctx: DraftContext,
): string {
  const lines = config.fields
    .map((field) => {
      const value = displayFieldValue(field, ctx.values[field.key]);
      return value ? `${field.descriptionLabel ?? field.label}: ${value}` : null;
    })
    .filter((line): line is string => Boolean(line));

  const extras = config.extraDescription?.(ctx) ?? [];
  return [...lines, ...extras].join('\n').trim();
}

export function composeTitle(config: ServiceConfig, ctx: DraftContext): string {
  return clip(config.titleFor(ctx).trim() || config.label, 150);
}

export function initialValues(
  config: ServiceConfig,
  prefillTitle?: string,
  urgencyParam?: string,
): DraftValues {
  const values: DraftValues = { ...(config.defaults ?? {}) };
  if (prefillTitle) {
    Object.assign(values, config.prefill?.(prefillTitle) ?? {});
  }
  if (config.urgencyMode === 'emergency' && urgencyParam === 'EMERGENCY') {
    values.emergency = 'Yes';
  }
  return values;
}

export function initialUrgency(
  config: ServiceConfig,
  urgencyParam?: string,
): Urgency {
  if (urgencyParam === 'NORMAL' || urgencyParam === 'URGENT' || urgencyParam === 'EMERGENCY') {
    return urgencyParam;
  }
  return config.category === 'ROADSIDE' ? 'URGENT' : 'NORMAL';
}


/** -------------------------------------------------------------- submit */

export function buildPayload(
  config: ServiceConfig,
  ctx: DraftContext,
  extras: {
    photos: string[];
    isBroadcast: boolean;
  },
): CreateServiceRequest {
  const place = effectiveLocationFor(config, ctx);
  if (!place) throw new Error('Location is required before submitting.');

  const payload: CreateServiceRequest = {
    category: config.category,
    title: composeTitle(config, ctx),
    description: composeDescription(config, ctx),
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    urgency: ctx.urgency,
    mediaUrls: extras.photos,
    damagePhotos: extras.photos,
    isBroadcast: extras.isBroadcast,
  };

  if (ctx.selectedVehicle) {
    payload.vehicleId = ctx.selectedVehicle.id;
  } else {
    payload.vehicleMake = ctx.manualVehicle.make.trim();
    payload.vehicleModel = ctx.manualVehicle.model.trim();
    payload.vehicleYear = Number(ctx.manualVehicle.year);
  }

  if (config.category === 'TOWING') {
    if (!ctx.dropoff) throw new Error('Destination is required before submitting.');
    payload.fulfillmentType = 'TOW_TO_GARAGE';
    payload.dropoffAddress = ctx.dropoff.address;
    payload.dropoffLatitude = ctx.dropoff.latitude;
    payload.dropoffLongitude = ctx.dropoff.longitude;
    payload.towingVehicleType = ctx.values.towingType as
      | 'FLATBED'
      | 'HOOK_AND_CHAIN'
      | 'MOTORCYCLE'
      | 'ANY';
  } else if (config.category === 'SPARE_PART') {
    payload.fulfillmentType =
      ctx.spareFulfillment === 'DELIVERY' ? 'PARTS_SHIPPING' : 'WORKSHOP_VISIT';
  } else if (config.category === 'ROADSIDE') {
    payload.fulfillmentType = 'ON_SITE';
    payload.roadsideKind =
      ROADSIDE_KIND_MAP[ctx.values.assistanceType] ?? undefined;
  } else {
    payload.fulfillmentType = 'ON_SITE';
  }

  return payload;
}
