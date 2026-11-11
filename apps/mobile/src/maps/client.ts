/**
 * Mapbox REST client — geocoding, reverse geocoding and directions.
 *
 * Deliberately dependency-free: no native map SDK, so the existing dev client
 * keeps working. Every call is token-gated, timeout-bounded, abortable and
 * memoised for a short window to avoid duplicate billable requests.
 */

import { MAPBOX_API, MAPBOX_TOKEN, GEOCODE_COUNTRY, hasMapAccess } from './config';
import type { LatLng } from './geo';

export type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  distanceM: number;
  durationS: number;
  geometry: LatLng[];
};

export class MapRequestError extends Error {
  readonly aborted: boolean;

  constructor(message: string, aborted = false) {
    super(message);
    this.name = 'MapRequestError';
    this.aborted = aborted;
  }
}

const REQUEST_TIMEOUT_MS = 9000;

type CacheEntry = { value: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 160;

function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Refresh LRU position.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value as T;
}

function writeCache(key: string, value: unknown, ttlMs: number) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function coordinateKey(coordinate: LatLng, precision = 5) {
  return `${coordinate.latitude.toFixed(precision)},${coordinate.longitude.toFixed(precision)}`;
}

async function getJson(
  url: string,
  signal?: AbortSignal,
): Promise<any> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) throw new MapRequestError('Request cancelled', true);
    signal.addEventListener('abort', abort);
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new MapRequestError(
        response.status === 401 || response.status === 403
          ? 'Map access was rejected. Check the Mapbox token restrictions.'
          : 'The map service is unavailable right now.',
      );
    }
    return await response.json();
  } catch (error: any) {
    if (error instanceof MapRequestError) throw error;
    if (timedOut) {
      throw new MapRequestError('The map service timed out. Check your connection.');
    }
    if (error?.name === 'AbortError' || signal?.aborted) {
      throw new MapRequestError('Request cancelled', true);
    }
    throw new MapRequestError('Could not reach the map service. Check your connection.');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

function featureToPlace(feature: any): Place | null {
  const center = feature?.center;
  if (!Array.isArray(center) || center.length < 2) return null;
  const longitude = Number(center[0]);
  const latitude = Number(center[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address: string = feature.place_name ?? feature.name ?? '';
  return {
    id: String(feature.id ?? `${longitude},${latitude}`),
    name: String(feature.text ?? feature.name ?? address.split(',')[0] ?? ''),
    address,
    latitude,
    longitude,
  };
}

export type SearchOptions = {
  proximity?: LatLng;
  signal?: AbortSignal;
  limit?: number;
};

/** Address + landmark autocomplete. Returns [] when mapping is unconfigured. */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {},
): Promise<Place[]> {
  const trimmed = query.trim();
  if (!hasMapAccess || trimmed.length < 3) return [];

  const limit = options.limit ?? 6;
  const proximity = options.proximity ?? undefined;
  const key = [
    'search',
    trimmed.toLowerCase(),
    proximity ? coordinateKey(proximity, 2) : '',
    limit,
  ].join('|');
  const cached = readCache<Place[]>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    fuzzyMatch: 'true',
    language: 'en',
    limit: String(limit),
    country: GEOCODE_COUNTRY,
    types: 'address,poi,place,locality,neighborhood',
  });
  if (proximity) {
    params.set('proximity', `${proximity.longitude},${proximity.latitude}`);
  }

  const payload = await getJson(
    `${MAPBOX_API}/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?${params.toString()}`,
    options.signal,
  );

  const places = (payload?.features ?? [])
    .map(featureToPlace)
    .filter((place: Place | null): place is Place => Boolean(place));

  writeCache(key, places, 5 * 60 * 1000);
  return places;
}

/** Resolve a coordinate to a human address. Returns null when unknown. */
export async function reverseGeocode(
  coordinate: LatLng,
  signal?: AbortSignal,
): Promise<Place | null> {
  if (!hasMapAccess) return null;

  const key = `reverse|${coordinateKey(coordinate, 5)}`;
  const cached = readCache<Place | null>(key);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    language: 'en',
    limit: '1',
    types: 'address,poi,place,locality,neighborhood',
  });

  const payload = await getJson(
    `${MAPBOX_API}/geocoding/v5/mapbox.places/${coordinate.longitude},${coordinate.latitude}.json?${params.toString()}`,
    signal,
  );

  const place = (payload?.features ?? []).map(featureToPlace).find(Boolean) ?? null;
  writeCache(key, place, 5 * 60 * 1000);
  return place as Place | null;
}

/** Driving route between two points: geometry + distance + duration. */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<RouteResult> {
  if (!hasMapAccess) {
    throw new MapRequestError('Map routing is not configured.');
  }
  if (
    Math.abs(from.latitude - to.latitude) < 1e-7 &&
    Math.abs(from.longitude - to.longitude) < 1e-7
  ) {
    throw new MapRequestError('Pickup and destination are the same point.');
  }

  const key = `route|${coordinateKey(from, 4)}|${coordinateKey(to, 4)}`;
  const cached = readCache<RouteResult>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: 'false',
    language: 'en',
  });

  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const payload = await getJson(
    `${MAPBOX_API}/directions/v5/mapbox/driving/${path}?${params.toString()}`,
    signal,
  );

  const route = payload?.routes?.[0];
  if (!route) {
    throw new MapRequestError('No driving route found between these points.');
  }

  const geometry: LatLng[] = (route.geometry?.coordinates ?? [])
    .map((pair: [number, number]) => ({
      latitude: Number(pair[1]),
      longitude: Number(pair[0]),
    }))
    .filter(
      (point: LatLng) =>
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
    );

  const result: RouteResult = {
    distanceM: Number(route.distance ?? 0),
    durationS: Number(route.duration ?? 0),
    geometry,
  };
  writeCache(key, result, 45 * 1000);
  return result;
}
