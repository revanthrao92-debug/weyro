import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import io, { Socket } from 'socket.io-client';
import { API_URL } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';

export function useTracking(
  bookingId: string | null,
  onLocationUpdate: (location: {
    latitude: number;
    longitude: number;
    etaMinutes?: number;
    updatedAt: string;
  }) => void,
  onStatusUpdate: (status: string) => void
) {
  useEffect(() => {
    if (!bookingId) return;

    let socket: Socket;

    async function connect() {
      const token = await tokenStorage.getAccessToken();
      socket = io(API_URL.replace('/api/v1', ''), {
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('connect', () => {
        socket.emit('join_booking', { bookingId });
      });

      socket.on('booking_location', (data: {
        latitude: number;
        longitude: number;
        etaMinutes?: number;
        updatedAt: string;
      }) => {
        onLocationUpdate(data);
      });

      socket.on('booking_status', (data: { status: string }) => {
        onStatusUpdate(data.status);
      });

      socket.on('disconnect', () => {
        // Non-blocking; reconnect handled by socket.io
      });
    }

    connect();

    return () => {
      socket?.disconnect();
    };
  }, [bookingId, onLocationUpdate, onStatusUpdate]);

  const sendLocation = useCallback(
    async (latitude: number, longitude: number, etaMinutes?: number) => {
      // Location updates are sent via the backend PATCH endpoint,
      // socket is only for receiving updates
    },
    []
  );

  return { sendLocation };
}
