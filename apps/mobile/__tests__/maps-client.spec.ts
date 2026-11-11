/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Mapbox REST client — parsing, caching, proximity and failure behaviour.
 * `fetch` is mocked; no network or token is required.
 */

const originalToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

function loadClient() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../src/maps/client') as typeof import('../src/maps/client');
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('Mapbox client', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.test';
    // @ts-expect-error global fetch in jest-expo
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = originalToken;
    jest.useRealTimers();
  });

  it('parses autocomplete features and reuses the cache', async () => {
    const { searchPlaces } = loadClient();
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            id: 'place.1',
            text: 'Indiranagar',
            place_name: 'Indiranagar, Bengaluru, Karnataka, India',
            center: [77.6408, 12.9784],
          },
        ],
      }),
    );

    const proximity = { latitude: 12.9716, longitude: 77.5946 };
    const first = await searchPlaces('indira', { proximity });
    expect(first).toEqual([
      {
        id: 'place.1',
        name: 'Indiranagar',
        address: 'Indiranagar, Bengaluru, Karnataka, India',
        latitude: 12.9784,
        longitude: 77.6408,
      },
    ]);

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('access_token=pk.test');
    expect(url).toContain('proximity=77.5946%2C12.9716');
    expect(url).toContain('country=in');

    const second = await searchPlaces('indira', { proximity });
    expect(second).toEqual(first);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not call the network for queries shorter than 3 characters', async () => {
    const { searchPlaces } = loadClient();
    expect(await searchPlaces('in')).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('parses a driving route into distance, duration and geometry', async () => {
    const { fetchRoute } = loadClient();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        routes: [
          {
            distance: 5180.4,
            duration: 780,
            geometry: {
              type: 'LineString',
              coordinates: [
                [77.5946, 12.9716],
                [77.61, 12.95],
                [77.6245, 12.9352],
              ],
            },
          },
        ],
      }),
    );

    const route = await fetchRoute(
      { latitude: 12.9716, longitude: 77.5946 },
      { latitude: 12.9352, longitude: 77.6245 },
    );

    expect(route.distanceM).toBeCloseTo(5180.4, 1);
    expect(route.durationS).toBe(780);
    expect(route.geometry).toHaveLength(3);
    expect(route.geometry[1]).toEqual({ latitude: 12.95, longitude: 77.61 });
  });

  it('rejects instead of returning an empty route', async () => {
    const { fetchRoute, MapRequestError } = loadClient();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ routes: [] }));

    await expect(
      fetchRoute(
        { latitude: 12.9716, longitude: 77.5946 },
        { latitude: 12.9352, longitude: 77.6245 },
      ),
    ).rejects.toBeInstanceOf(MapRequestError);
  });

  it('maps HTTP failures to a readable error', async () => {
    const { searchPlaces, MapRequestError } = loadClient();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response('{}', { status: 401 }),
    );

    await expect(searchPlaces('indiranagar')).rejects.toMatchObject({
      name: 'MapRequestError',
      message: expect.stringContaining('token restrictions'),
    });
    await expect(searchPlaces('indiranagar')).rejects.toBeInstanceOf(
      MapRequestError,
    );
  });

  it('returns no places and makes no request when no token is configured', async () => {
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    const { searchPlaces, reverseGeocode } = (() => {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../src/maps/client') as typeof import('../src/maps/client');
    })();

    expect(await searchPlaces('indiranagar')).toEqual([]);
    expect(await reverseGeocode({ latitude: 12.9, longitude: 77.6 })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
