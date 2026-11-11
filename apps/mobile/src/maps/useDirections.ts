import { useEffect, useState } from 'react';
import { fetchRoute, MapRequestError, type RouteResult } from './client';

type DirectionsResult = {
  key: string;
  route: RouteResult | null;
  error: string | null;
};

type DirectionsState = {
  loading: boolean;
  route: RouteResult | null;
  error: string | null;
};

type LatLngLike = { latitude: number; longitude: number } | null | undefined;

const coordinateKey = (point: LatLngLike) =>
  point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : null;

/**
 * Route + distance + ETA between two committed points. Re-queries only when a
 * coordinate actually changes; the client cache absorbs retries. Loading is
 * derived, so switching points never shows the previous route.
 */
export function useDirections(from?: LatLngLike, to?: LatLngLike): DirectionsState {
  const fromKey = coordinateKey(from);
  const toKey = coordinateKey(to);
  const key = fromKey && toKey ? `${fromKey}|${toKey}` : null;

  const [result, setResult] = useState<DirectionsResult | null>(null);

  useEffect(() => {
    if (!from || !to || !key) return;

    let cancelled = false;
    const controller = new AbortController();

    fetchRoute(from, to, controller.signal)
      .then((route) => {
        if (!cancelled) setResult({ key, route, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof MapRequestError && error.aborted) return;
        setResult({
          key,
          route: null,
          error:
            error instanceof MapRequestError
              ? error.message
              : 'Route unavailable right now.',
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // The key encodes every coordinate we depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = key && result?.key === key ? result : null;

  return {
    loading: Boolean(key) && !current,
    route: current?.route ?? null,
    error: current?.error ?? null,
  };
}
