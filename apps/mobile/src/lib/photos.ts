/**
 * Weyro photo library — the single source of truth for UI imagery.
 * Real automotive photography (stable Unsplash CDN URLs).
 *
 * Swapping to your own CDN later = edit only this file (reversibility),
 * same contract: a Map keyed by subject. Every component that needs a
 * photo imports from here — never hardcode URLs in screens.
 */

export type CarMake =
  | 'tata'
  | 'honda'
  | 'mahindra'
  | 'kia'
  | 'bmw'
  | 'audi';

export type PhotoSubject =
  | 'repair'
  | 'spare-parts'
  | 'towing'
  | 'mechanic'
  | 'brake-disc'
  | 'engine'
  | 'car-hero'
  | 'garage-default';

const S: Record<PhotoSubject, string> = {
  repair:
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
  'spare-parts':
    'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=900&q=80',
  towing:
    'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=900&q=80',
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
};

/** Get a photo URL by subject. Always returns something renderable. */
export function photo(subject: PhotoSubject): string {
  return S[subject];
}

// Curated real photography per make (stable Unsplash CDN). A deliberately
// small map; unknown makes fall back to the garage shot.
// shortcut: the Maruti, Hyundai and Toyota photos (and the unused shop banner) returned 404
// on 2026-11-20 and were removed; those makes show an icon until real photos are added here.
export const CAR_PHOTOS: Record<CarMake, string> = {
  tata:
    'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=800&q=80',
  honda:
    'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=800&q=80',
  mahindra:
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
  kia:
    'https://images.unsplash.com/photo-1552519507-88aa2dfa9fdb?auto=format&fit=crop&w=800&q=80',
  bmw:
    'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=800&q=80',
  audi:
    'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?auto=format&fit=crop&w=800&q=80',
};

/** Stock photo for a make, or null when we have none (show an icon, never another car). */
export function carPhotoFor(make?: string | null, _model?: string | null): string | null {
  const key = (make ?? '').toLowerCase();
  const known = Object.keys(CAR_PHOTOS) as CarMake[];
  const hit = known.find((m) => key.includes(m));
  return hit ? CAR_PHOTOS[hit] : null;
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
