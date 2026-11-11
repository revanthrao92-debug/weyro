/**
 * Mapping configuration — Mapbox.
 *
 * Only the *public* token ever reaches the client. It must be a URL-restricted
 * token (Mapbox: restrict to the bundle id / package name and to the styles,
 * geocoding and directions endpoints). Never put a secret `sk.` token here.
 *
 * When no token is configured the app degrades to manual address entry and
 * saved/current location — no map surface, no dead controls.
 */

const rawToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export const MAPBOX_TOKEN = typeof rawToken === 'string' ? rawToken.trim() : '';
export const hasMapAccess = MAPBOX_TOKEN.length > 0;

/** Dark automotive style. Override with another mapbox/{style} id if needed. */
export const MAP_STYLE = process.env.EXPO_PUBLIC_MAPBOX_STYLE?.trim() || 'mapbox/dark-v11';

export const MAPBOX_API = 'https://api.mapbox.com';

/** Bengaluru fallback centre — the seeded market. */
export const FALLBACK_CENTER = { latitude: 12.9716, longitude: 77.5946 };

export const DEFAULT_ZOOM = 15;
export const MIN_ZOOM = 8;
export const MAX_ZOOM = 19;

/** Limit geocoding to the market we operate in (cost control). */
export const GEOCODE_COUNTRY = 'in';

/** Debounce/dedupe tuning. */
export const SEARCH_DEBOUNCE_MS = 320;
export const REVERSE_DEBOUNCE_MS = 450;
/** Do not re-geocode for pans smaller than this (no wasted requests). */
export const REVERSE_MIN_MOVE_M = 12;
