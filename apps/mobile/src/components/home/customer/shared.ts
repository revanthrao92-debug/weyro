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


export const HERO_IMAGE = require('../../../../assets/images/hero-primary.jpg');
// Workshop band: Unsplash (photo-1615906655593-ad0386982a0f), cropped + graded
// locally; Unsplash license allows commercial use without attribution.


/** Shop navigation categories — used when the catalogue has no listings yet. */


export const PACKAGES = [
  { title: 'Standard service', detail: 'Oil, filters, 30-point check', category: 'MAINTENANCE' },
  { title: 'AC service', detail: 'Cooling check, gas, cabin filter', category: 'MAINTENANCE' },
  { title: 'Pre-purchase check', detail: '200-point inspection', category: 'INSPECTION' },
];


