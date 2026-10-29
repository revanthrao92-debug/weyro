/**
 * Weyro photo library — the single source of truth for UI imagery.
 * Real automotive photography (stable Unsplash CDN URLs).
 *
 * Swapping to your own CDN later = edit only this file (reversibility),
 * same contract: a Map keyed by subject. Every component that needs a
 * photo imports from here — never hardcode URLs in screens.
 */

export type PhotoSubject =
  | 'repair'
  | 'spare-parts'
  | 'towing'
  | 'mechanic'
  | 'brake-disc'
  | 'engine'
  | 'car-hero'
  | 'garage-default'
  | 'shop-banner';

const S: Record<PhotoSubject, string> = {
  repair:
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
  'spare-parts':
    'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=900&q=80',
  towing:
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd6?auto=format&fit=crop&w=900&q=80',
  mechanic:
    'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=900&q=80',
  'brake-disc':
    'https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&w=900&q=80',
  engine:
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=80',
  'car-hero':
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80',
  'garage-default':
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=600&q=80',
  'shop-banner':
    'https://images.unsplash.com/photo-1503478377469-30f7d8bfa8e7?auto=format&fit=crop&w=900&q=80',
};

/** Get a photo URL by subject. Always returns something renderable. */
export function photo(subject: PhotoSubject): string {
  return S[subject];
}

/** Map an API category string (e.g. 'REPAIR', 'TOWING') to a subject. */
export function photoForCategory(category?: string | null): PhotoSubject {
  switch ((category ?? '').toUpperCase()) {
    case 'REPAIR':
      return 'repair';
    case 'SPARE_PART':
    case 'SPARE_PARTS':
      return 'spare-parts';
    case 'TOWING':
      return 'towing';
    case 'ROADSIDE':
      return 'mechanic';
    case 'ENGINE':
      return 'engine';
    case 'BRAKES':
      return 'brake-disc';
    default:
      return 'garage-default';
  }
}
