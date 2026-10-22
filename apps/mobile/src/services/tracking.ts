import { io, type Socket } from 'socket.io-client';
import { apiClient, API_BASE_URL } from './api-client';
import { tokenStorage } from './token-storage';

export interface TrackingUpdate {
  bookingId: string;
  latitude: number;
  longitude: number;
  etaMinutes: number | null;
  updatedAt: string;
}

export interface BookingTracking {
  bookingId: string;
  status: string;
  providerLatitude: number | null;
  providerLongitude: number | null;
  providerLocationUpdatedAt: string | null;
  etaMinutes: number | null;
}

/**
 * Socket.IO base URL. The API lives under `/api/v1`, but socket namespaces
 * are mounted on the server root.
 */
export function trackingSocketUrl(): string {
  const base = API_BASE_URL || 'http://localhost:4000';
  return base.replace(/\/api\/v1\/?$/, '');
}

let socket: Socket | null = null;
let socketToken: string | null = null;

async function getSocket(): Promise<Socket> {
  const token = await tokenStorage.getAccessToken();

  if (socket && socketToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket?.disconnect();
  socketToken = token;
  socket = io(`${trackingSocketUrl()}/tracking`, {
    transports: ['websocket'],
    auth: { token: token ?? '' },
    reconnection: true,
    reconnectionAttempts: 10,
  });

  return socket;
}

/**
 * Subscribe to live location updates for a booking. Returns an unsubscribe
 * function. Updates are also persisted server-side, so the REST endpoint below
 * remains the source of truth after reconnects.
 */
export async function subscribeToBookingTracking(
  bookingId: string,
  onUpdate: (update: TrackingUpdate) => void,
): Promise<() => void> {
  const activeSocket = await getSocket();

  const handler = (payload: TrackingUpdate) => {
    if (payload?.bookingId === bookingId) onUpdate(payload);
  };

  activeSocket.on('booking_location', handler);
  activeSocket.emit('join_booking', { bookingId });

  return () => {
    activeSocket.off('booking_location', handler);
  };
}

export async function fetchBookingTracking(
  bookingId: string,
): Promise<BookingTracking> {
  return apiClient.get<BookingTracking>(`/bookings/${bookingId}/tracking`);
}

export async function publishBookingLocation(
  bookingId: string,
  location: {
    latitude: number;
    longitude: number;
    etaMinutes?: number;
  },
): Promise<void> {
  await apiClient.patch(`/bookings/${bookingId}/location`, location);
}

export function disconnectTracking(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
