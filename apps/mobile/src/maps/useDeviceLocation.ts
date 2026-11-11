import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from './geo';

export type DeviceLocationStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'error';

export type DeviceLocationState = {
  status: DeviceLocationStatus;
  coords?: LatLng;
  accuracyM?: number;
  message?: string;
};

/**
 * One-shot device location. Nothing is requested until the customer taps
 * "Use my location", and we never poll — a single high-accuracy-enough fix is
 * plenty for a pickup point.
 */
export function useDeviceLocation() {
  const [state, setState] = useState<DeviceLocationState>({ status: 'idle' });
  const inFlight = useRef(false);

  const request = useCallback(async (): Promise<LatLng | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setState((current) => ({ ...current, status: 'requesting', message: undefined }));

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setState({
          status: 'denied',
          message: permission.canAskAgain
            ? 'Location permission was denied. Pick a point on the map or type the address.'
            : 'Location is turned off for Weyro. Pick a point on the map or type the address.',
        });
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setState({
        status: 'ready',
        coords,
        accuracyM: position.coords.accuracy ?? undefined,
      });
      return coords;
    } catch {
      setState({
        status: 'error',
        message: 'Could not get your location. Move somewhere with a clearer signal and retry.',
      });
      return null;
    } finally {
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { ...state, request, reset };
}
