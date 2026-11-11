import {
  ClipboardCheck,
  LifeBuoy,
  Package,
  Settings2,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';

export type HomeServiceCategory =
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'SPARE_PART'
  | 'TOWING'
  | 'ROADSIDE'
  | 'INSPECTION';

export type HomeService = {
  category: HomeServiceCategory;
  label: string;
  detail: string;
  Icon: LucideIcon;
  /** Label on the urgent action pill. */
  actionLabel?: string;
};

/** The three services customers book most often. */
export const PRIMARY_SERVICES: HomeService[] = [
  {
    category: 'REPAIR',
    label: 'Repair',
    detail: 'Bodywork, dents, paint',
    Icon: Wrench,
  },
  {
    category: 'MAINTENANCE',
    label: 'Maintenance',
    detail: 'Oil, filters, scheduled service',
    Icon: Settings2,
  },
  {
    category: 'SPARE_PART',
    label: 'Spare parts',
    detail: 'Genuine and aftermarket',
    Icon: Package,
  },
];

/** Time-sensitive help, surfaced above the quieter services. */
export const URGENT_SERVICES: HomeService[] = [
  {
    category: 'TOWING',
    label: 'Towing',
    detail: 'Flatbed, wheel-lift',
    Icon: Truck,
    actionLabel: 'Tow now',
  },
  {
    category: 'ROADSIDE',
    label: 'Roadside',
    detail: 'Battery, tyre, fuel, lockout',
    Icon: LifeBuoy,
    actionLabel: 'Get help',
  },
];

/** Secondary services, kept compact. */
export const ADDITIONAL_SERVICES: HomeService[] = [
  {
    category: 'INSPECTION',
    label: 'Vehicle inspection',
    detail: 'Pre-purchase, roadworthy, diagnostics',
    Icon: ClipboardCheck,
  },
];

/** Existing one-tap emergency kinds, unchanged routes. */
export const SOS_KINDS = ['Battery', 'Tyre', 'Fuel', 'Tow'] as const;

export type SosKind = (typeof SOS_KINDS)[number];

export function requestRoute(category: HomeServiceCategory): string {
  return `/requests/create?category=${category}`;
}

export function sosRoute(kind: SosKind): string {
  return `/sos?kind=${kind === 'Tow' ? 'TOW' : kind.toUpperCase()}`;
}
