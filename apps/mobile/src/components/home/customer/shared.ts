import { BatteryCharging, Cog, Disc3, Filter, Settings2, Zap } from 'lucide-react-native';
import { StatusTone } from '@/theme';

export function requestTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN':
    case 'QUOTES_RECEIVED':
      return 'info';
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function bookingTone(status: string): StatusTone {
  switch (status) {
    case 'CONFIRMED':
    case 'PROVIDER_EN_ROUTE':
      return 'info';
    case 'IN_PROGRESS':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'DISPUTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const HERO_IMAGE = require('../../../assets/images/hero-primary.jpg');
// Workshop band: Unsplash (photo-1615906655593-ad0386982a0f), cropped + graded
// locally; Unsplash license allows commercial use without attribution.


/** Shop navigation categories — used when the catalogue has no listings yet. */
export const PART_CATEGORIES = [
  { label: 'Brakes', detail: 'Pads, discs, fluid', Icon: Disc3 },
  { label: 'Filters', detail: 'Oil, air, cabin', Icon: Filter },
  { label: 'Batteries', detail: 'Start-stop, EFB, AGM', Icon: BatteryCharging },
  { label: 'Suspension', detail: 'Shocks, bushes, links', Icon: Settings2 },
  { label: 'Engine', detail: 'Belts, sensors, gaskets', Icon: Cog },
  { label: 'Electrical', detail: 'Bulbs, relays, wiring', Icon: Zap },
];

export const FOOTER_LINKS = [
  { label: 'Post request', route: '/requests/create' },
  { label: 'Shop', route: '/shop' },
  { label: 'Bookings', route: '/bookings' },
  { label: 'Vehicles', route: '/vehicles' },
  { label: 'Messages', route: '/messages' },
  { label: 'Roadside', route: '/sos' },
  { label: 'Help', route: '/help' },
  { label: 'Profile', route: '/profile' },
];

export const PACKAGES = [
  { title: 'Standard service', detail: 'Oil, filters, 30-point check', category: 'MAINTENANCE' },
  { title: 'AC service', detail: 'Cooling check, gas, cabin filter', category: 'MAINTENANCE' },
  { title: 'Pre-purchase check', detail: '200-point inspection', category: 'INSPECTION' },
];


