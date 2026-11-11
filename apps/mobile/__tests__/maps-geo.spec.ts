/* global describe, it, expect */
/**
 * Mapping maths + formatting. These cover the projection contract that keeps
 * tiles, pins and route overlays aligned, plus the user-facing units.
 */
import {
  centerOf,
  fitZoom,
  formatDistance,
  formatDuration,
  haversineMeters,
  isNear,
  offsetCoordinate,
  project,
  simplifyRoute,
  unproject,
} from '../src/maps/geo';

const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };

describe('map projection', () => {
  it('round-trips a coordinate through project/unproject', () => {
    for (const zoom of [8, 12, 16, 19]) {
      const back = unproject(project(BENGALURU, zoom), zoom);
      expect(back.latitude).toBeCloseTo(BENGALURU.latitude, 6);
      expect(back.longitude).toBeCloseTo(BENGALURU.longitude, 6);
    }
  });

  it('centres the world at (0,0) on zoom 0', () => {
    const point = project({ latitude: 0, longitude: 0 }, 0);
    expect(point.x).toBeCloseTo(128, 6);
    expect(point.y).toBeCloseTo(128, 6);
  });

  it('moves a coordinate by an exact pixel delta', () => {
    const moved = offsetCoordinate(BENGALURU, 100, -50, 16);
    const before = project(BENGALURU, 16);
    const after = project(moved, 16);
    expect(after.x - before.x).toBeCloseTo(100, 4);
    expect(after.y - before.y).toBeCloseTo(-50, 4);
  });
});

describe('distance + display units', () => {
  it('measures a known latitude delta (~1.11 km per 0.01°)', () => {
    const meters = haversineMeters(
      { latitude: 12.0, longitude: 77.0 },
      { latitude: 12.01, longitude: 77.0 },
    );
    expect(meters).toBeGreaterThan(1100);
    expect(meters).toBeLessThan(1120);
  });

  it('formats short and long distances', () => {
    expect(formatDistance(120)).toBe('120 m');
    expect(formatDistance(2360)).toBe('2.4 km');
    expect(formatDistance(18200)).toBe('18 km');
    expect(formatDistance(Number.NaN)).toBe('—');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('1 min');
    expect(formatDuration(32 * 60)).toBe('32 min');
    expect(formatDuration(90 * 60)).toBe('1 hr 30 min');
    expect(formatDuration(120 * 60)).toBe('2 hr');
  });

  it('detects proximity within a radius', () => {
    expect(isNear(BENGALURU, BENGALURU, 5)).toBe(true);
    expect(
      isNear(BENGALURU, { latitude: 12.98, longitude: 77.5946 }, 50),
    ).toBe(false);
  });
});

describe('route fitting', () => {
  it('fits two points inside the viewport', () => {
    const zoom = fitZoom(
      [BENGALURU, { latitude: 12.9352, longitude: 77.6245 }],
      390,
      176,
      48,
    );
    expect(zoom).toBeGreaterThanOrEqual(8);
    expect(zoom).toBeLessThanOrEqual(16);

    // Both points projected at that zoom must fit the padded viewport width.
    const projected = [BENGALURU, { latitude: 12.9352, longitude: 77.6245 }].map(
      (point) => project(point, zoom),
    );
    const span = Math.abs(projected[0].x - projected[1].x);
    expect(span).toBeLessThanOrEqual(390);
  });

  it('returns a usable zoom before layout is measured', () => {
    expect(fitZoom([BENGALURU], 0, 0)).toBe(15);
    expect(fitZoom([], 390, 176)).toBe(14);
  });

  it('centres between points', () => {
    const center = centerOf([
      { latitude: 10, longitude: 20 },
      { latitude: 20, longitude: 30 },
    ]);
    expect(center.latitude).toBe(15);
    expect(center.longitude).toBe(25);
  });

  it('simplifies near-duplicate route points without losing endpoints', () => {
    const points = [
      { latitude: 12.9, longitude: 77.5 },
      { latitude: 12.900001, longitude: 77.500001 },
      { latitude: 12.95, longitude: 77.55 },
      { latitude: 12.99, longitude: 77.6 },
    ];
    const simplified = simplifyRoute(points, 6);
    expect(simplified).toHaveLength(3);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[3]);
  });
});
