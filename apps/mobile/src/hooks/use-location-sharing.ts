import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { publishBookingLocation } from '@/services/tracking';

const UPDATE_INTERVAL_MS = 15_000;
const UPDATE_DISTANCE_M = 25;

/**
 * Shares the provider's foreground location while a booking is active.
 * Updates are throttled to once every 15s / 25m and persisted through the API.
 */
export function useLocationSharing(bookingId?: string) {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsSharing(false);
  }, []);

  const start = useCallback(async () => {
    if (!bookingId || subscriptionRef.current) return;

    setError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission is required to share your live position.');
      return;
    }

    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: UPDATE_INTERVAL_MS,
          distanceInterval: UPDATE_DISTANCE_M,
        },
        (position) => {
          void publishBookingLocation(bookingId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }).catch(() => {
            // Transient network failures are retried by the next position event.
          });
        },
      );
      setIsSharing(true);
    } catch {
      setError('Unable to start location sharing on this device.');
    }
  }, [bookingId]);

  useEffect(() => stop, [stop]);

  return { isSharing, error, start, stop };
}
