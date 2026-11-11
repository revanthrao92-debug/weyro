/** Spherical Mercator helpers used by the raster map surface. */

export type LatLng = { latitude: number; longitude: number };

export const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export type Point = { x: number; y: number };

/** Latitude/longitude -> world pixel coordinates at a zoom level. */
export function project(coordinate: LatLng, zoom: number): Point {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const latitude = clamp(coordinate.latitude, -MAX_LATITUDE, MAX_LATITUDE);
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((coordinate.longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
}

/** World pixel coordinates -> latitude/longitude. */
export function unproject(point: Point, zoom: number): LatLng {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const longitude = (point.x / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / worldSize;
  const latitude =
    (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
}

/** Move a coordinate by a pixel delta at the given zoom. */
export function offsetCoordinate(
  coordinate: LatLng,
  dx: number,
  dy: number,
  zoom: number,
): LatLng {
  const projected = project(coordinate, zoom);
  return unproject({ x: projected.x + dx, y: projected.y + dy }, zoom);
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Zoom level that fits every point inside the viewport (with padding). */
export function fitZoom(
  points: LatLng[],
  width: number,
  height: number,
  padding = 56,
): number {
  if (points.length === 0) return 14;
  if (points.length === 1) return 15;
  if (width <= 0 || height <= 0) return 14;

  const projected = points.map((point) => project(point, 0));
  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));

  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const usableWidth = Math.max(80, width - padding * 2);
  const usableHeight = Math.max(80, height - padding * 2);

  const zoomX = Math.log2(usableWidth / spanX);
  const zoomY = Math.log2(usableHeight / spanY);
  return clamp(Math.floor(Math.min(zoomX, zoomY)), 8, 16);
}

/** Midpoint used to centre a set of points. */
export function centerOf(points: LatLng[]): LatLng {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const sum = points.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

/** True when two coordinates are within `meters` of each other. */
export function isNear(a: LatLng, b: LatLng, meters: number): boolean {
  return haversineMeters(a, b) <= meters;
}

/** Drop duplicate/near-duplicate points from a route geometry. */
export function simplifyRoute(points: LatLng[], toleranceM = 6): LatLng[] {
  if (points.length < 3) return points;
  const out: LatLng[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    if (haversineMeters(out[out.length - 1], points[i]) >= toleranceM) {
      out.push(points[i]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
