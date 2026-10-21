import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weyroNotifications } from './notifications';
import { apiClient } from './api-client';
import { offlineQueue, OfflineSyncStatus } from './offline-queue';

export interface DamageRequestQuote {
  id: string;
  providerName: string;
  providerType: 'MECHANIC' | 'PARTS_DEALER' | 'GARAGE';
  distanceNote: string;
  estimatedCost: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  eta: string;
  notes: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface DamageBroadcastRequest {
  id: string;
  customerName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  damagedPart: string;
  description: string;
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  fulfillmentType: 'WORKSHOP_VISIT' | 'ON_SITE' | 'PARTS_SHIPPING';
  damagePhotos: string[];
  isBroadcast: true;
  broadcastScope: 'BROADCAST_ALL';
  status: 'OPEN' | 'QUOTES_RECEIVED' | 'ACCEPTED' | 'COMPLETED';
  quotes: DamageRequestQuote[];
  createdAt: string;
}

export type BookingMilestoneStatus =
  | 'CONFIRMED'
  | 'DISPATCHED_OR_IN_BAY'
  | 'OUT_FOR_DELIVERY_OR_TESTING'
  | 'COMPLETED';

export interface BookingReview {
  rating: number;
  comment: string;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  requestId: string;
  quoteId: string;
  customerName: string;
  vehicle: string;
  damagedPart: string;
  providerName: string;
  providerType: 'MECHANIC' | 'PARTS_DEALER' | 'GARAGE';
  totalCost: number;
  partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
  eta: string;
  deliveryAddress: string;
  scheduledDate: string;
  status: BookingMilestoneStatus;
  fulfillmentType: 'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE';
  trackingNumber?: string;
  carrierName?: string;
  review?: BookingReview;
  confirmedAt: string;
  completedAt?: string;
}

const REQUESTS_CACHE_KEY = '@weyro/requests_cache_v2';
const BOOKINGS_CACHE_KEY = '@weyro/bookings_cache_v2';

let requests: DamageBroadcastRequest[] = [];
let bookings: BookingRecord[] = [];
let isSyncing = false;

type Listener = () => void;
let listeners: Listener[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

async function loadCachedState(): Promise<void> {
  try {
    const [cachedReqs, cachedBks] = await Promise.all([
      AsyncStorage.getItem(REQUESTS_CACHE_KEY),
      AsyncStorage.getItem(BOOKINGS_CACHE_KEY),
    ]);
    if (cachedReqs) requests = JSON.parse(cachedReqs);
    if (cachedBks) bookings = JSON.parse(cachedBks);
    emitChange();
  } catch {
    // Non-blocking cache read error
  }
}

async function persistState(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify(requests)),
      AsyncStorage.setItem(BOOKINGS_CACHE_KEY, JSON.stringify(bookings)),
    ]);
  } catch {
    // Non-blocking cache write error
  }
}

loadCachedState().then(() => {
  damageRequestStore.syncWithBackend().catch(() => {});
});

export const damageRequestStore = {
  getRequests(): DamageBroadcastRequest[] {
    return requests;
  },

  getBookings(): BookingRecord[] {
    return bookings;
  },

  getRequest(id: string): DamageBroadcastRequest | undefined {
    return requests.find((r) => r.id === id);
  },

  getBooking(id: string): BookingRecord | undefined {
    return bookings.find((b) => b.id === id);
  },

  async syncWithBackend(): Promise<void> {
    if (isSyncing) return;
    isSyncing = true;

    try {
      // 1. Fetch damage requests feed
      const feedRes = await apiClient.get<any>('/damage-requests/feed').catch(() => null);
      if (feedRes?.items && Array.isArray(feedRes.items)) {
        requests = feedRes.items.map((item: any) => ({
          id: item.id,
          customerName: `${item.customer?.firstName || 'Customer'} ${item.customer?.lastName || ''}`.trim(),
          vehicleMake: item.vehicle?.make || 'Unknown',
          vehicleModel: item.vehicle?.model || 'Vehicle',
          vehicleYear: item.vehicle?.year || new Date().getFullYear(),
          damagedPart: item.title,
          description: item.description,
          urgency: item.urgency,
          fulfillmentType: item.fulfillmentType,
          damagePhotos: (item.media || []).map((m: any) => m.url),
          isBroadcast: true,
          broadcastScope: 'BROADCAST_ALL',
          status: item.status,
          quotes: (item.quotations || []).map((q: any) => ({
            id: q.id,
            providerName: q.provider?.businessName || 'Provider',
            providerType: q.provider?.providerType || 'GARAGE',
            distanceNote: `${q.provider?.address || 'Local workshop'}`,
            estimatedCost: q.totalCost,
            partCondition: q.partCondition,
            eta: q.etaDescription || '1-2 days',
            notes: q.notes || '',
            status: q.status,
            createdAt: q.createdAt,
          })),
          createdAt: item.createdAt,
        }));
      }

      // 2. Fetch bookings
      const bookingsRes = await apiClient.get<any>('/quotations/bookings').catch(() => null);
      if (bookingsRes?.items && Array.isArray(bookingsRes.items)) {
        bookings = bookingsRes.items.map((b: any) => ({
          id: b.id,
          requestId: b.quotation?.requestId || '',
          quoteId: b.quotationId,
          customerName: `${b.customer?.firstName || 'Customer'} ${b.customer?.lastName || ''}`.trim(),
          vehicle: `${b.quotation?.request?.vehicle?.year || ''} ${b.quotation?.request?.vehicle?.make || ''} ${b.quotation?.request?.vehicle?.model || ''}`.trim(),
          damagedPart: b.quotation?.request?.title || 'Automotive Service',
          providerName: b.provider?.businessName || 'Provider',
          providerType: b.provider?.providerType || 'GARAGE',
          totalCost: b.quotation?.totalCost || 0,
          partCondition: b.quotation?.partCondition,
          eta: b.quotation?.etaDescription || 'Confirmed',
          deliveryAddress: b.completionNotes || b.provider?.address || 'Workshop',
          scheduledDate: b.scheduledAt,
          status: b.status === 'PROVIDER_EN_ROUTE' ? 'DISPATCHED_OR_IN_BAY'
                : b.status === 'IN_PROGRESS' ? 'OUT_FOR_DELIVERY_OR_TESTING'
                : b.status,
          fulfillmentType: b.quotation?.request?.fulfillmentType || 'WORKSHOP_VISIT',
          review: b.review ? {
            rating: b.review.rating,
            comment: b.review.comment || '',
            createdAt: b.review.createdAt,
          } : undefined,
          confirmedAt: b.createdAt,
          completedAt: b.completedAt,
        }));
      }

      await persistState();
      emitChange();
    } finally {
      isSyncing = false;
    }
  },

  createBroadcastRequest(params: {
    customerName: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    damagedPart: string;
    description: string;
    urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
    fulfillmentType: 'WORKSHOP_VISIT' | 'ON_SITE' | 'PARTS_SHIPPING';
    damagePhotos: string[];
    latitude?: number;
    longitude?: number;
    address?: string;
  }): DamageBroadcastRequest {
    const newReq: DamageBroadcastRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      customerName: params.customerName,
      vehicleMake: params.vehicleMake,
      vehicleModel: params.vehicleModel,
      vehicleYear: params.vehicleYear,
      damagedPart: params.damagedPart,
      description: params.description,
      urgency: params.urgency,
      fulfillmentType: params.fulfillmentType,
      damagePhotos: params.damagePhotos,
      isBroadcast: true,
      broadcastScope: 'BROADCAST_ALL',
      status: 'OPEN',
      quotes: [],
      createdAt: new Date().toISOString(),
    };

    requests = [newReq, ...requests];
    persistState();
    emitChange();

    offlineQueue.enqueue(
      'CREATE_REQUEST',
      '/damage-requests',
      'POST',
      {
        vehicleMake: params.vehicleMake,
        vehicleModel: params.vehicleModel,
        vehicleYear: params.vehicleYear,
        category: 'MECHANICAL',
        title: params.damagedPart,
        description: params.description,
        urgency: params.urgency,
        fulfillmentType: params.fulfillmentType,
        latitude: params.latitude || 28.6139,
        longitude: params.longitude || 77.2090,
        address: params.address || 'New Delhi, India',
        mediaUrls: params.damagePhotos,
      },
    );

    return newReq;
  },

  submitQuote(
    requestId: string,
    quote: {
      providerName: string;
      providerType: 'MECHANIC' | 'PARTS_DEALER' | 'GARAGE';
      estimatedCost: number;
      partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
      eta: string;
      notes: string;
    },
  ): DamageRequestQuote | null {
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) return null;

    const targetReq = requests[reqIndex];
    const newQuote: DamageRequestQuote = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      providerName: quote.providerName,
      providerType: quote.providerType,
      distanceNote: 'Verified Local Partner',
      estimatedCost: quote.estimatedCost,
      partCondition: quote.partCondition,
      eta: quote.eta,
      notes: quote.notes,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const updatedReq: DamageBroadcastRequest = {
      ...targetReq,
      status: 'QUOTES_RECEIVED',
      quotes: [newQuote, ...targetReq.quotes],
    };

    requests = [
      ...requests.slice(0, reqIndex),
      updatedReq,
      ...requests.slice(reqIndex + 1),
    ];
    persistState();
    emitChange();

    offlineQueue.enqueue(
      'SUBMIT_QUOTE',
      `/damage-requests/${requestId}/quotations`,
      'POST',
      {
        totalCost: quote.estimatedCost,
        partCondition: quote.partCondition,
        etaDescription: quote.eta,
        notes: quote.notes,
      },
    );

    weyroNotifications.quoteReceived(
      quote.providerName,
      targetReq.damagedPart,
      quote.estimatedCost,
    );

    return newQuote;
  },

  acceptQuote(
    requestId: string,
    quoteId: string,
    details: { deliveryAddress: string; scheduledDate: string },
  ): BookingRecord | null {
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) return null;

    const targetReq = requests[reqIndex];
    const quoteIndex = targetReq.quotes.findIndex((q) => q.id === quoteId);
    if (quoteIndex === -1) return null;

    const acceptedQuote = targetReq.quotes[quoteIndex];

    const updatedQuotes: DamageRequestQuote[] = targetReq.quotes.map((q) => ({
      ...q,
      status: q.id === quoteId ? 'ACCEPTED' : 'REJECTED',
    }));

    const updatedReq: DamageBroadcastRequest = {
      ...targetReq,
      status: 'ACCEPTED',
      quotes: updatedQuotes,
    };

    const newBooking: BookingRecord = {
      id: `bk_${Date.now()}`,
      requestId: targetReq.id,
      quoteId: acceptedQuote.id,
      customerName: targetReq.customerName,
      vehicle: `${targetReq.vehicleYear} ${targetReq.vehicleMake} ${targetReq.vehicleModel}`,
      damagedPart: targetReq.damagedPart,
      providerName: acceptedQuote.providerName,
      providerType: acceptedQuote.providerType,
      totalCost: acceptedQuote.estimatedCost,
      partCondition: acceptedQuote.partCondition,
      eta: acceptedQuote.eta,
      deliveryAddress: details.deliveryAddress,
      scheduledDate: details.scheduledDate,
      status: 'CONFIRMED',
      fulfillmentType: targetReq.fulfillmentType,
      trackingNumber:
        targetReq.fulfillmentType === 'PARTS_SHIPPING'
          ? `WYR-${Math.floor(10000000 + Math.random() * 90000000)}IN`
          : undefined,
      carrierName:
        targetReq.fulfillmentType === 'PARTS_SHIPPING'
          ? 'Blue Dart Express'
          : undefined,
      confirmedAt: new Date().toISOString(),
    };

    requests = [
      ...requests.slice(0, reqIndex),
      updatedReq,
      ...requests.slice(reqIndex + 1),
    ];
    bookings = [newBooking, ...bookings];

    persistState();
    emitChange();

    offlineQueue.enqueue(
      'ACCEPT_QUOTE',
      `/quotations/${acceptedQuote.id}/accept`,
      'POST',
      {
        scheduledDate: details.scheduledDate,
        notes: details.deliveryAddress,
      },
    );

    return newBooking;
  },

  updateBookingStatus(
    bookingId: string,
    status: BookingMilestoneStatus,
    details?: { trackingNumber?: string; carrierName?: string },
  ): BookingRecord | null {
    const index = bookings.findIndex((b) => b.id === bookingId);
    if (index === -1) return null;

    const target = bookings[index];
    const updated: BookingRecord = {
      ...target,
      status,
      trackingNumber: details?.trackingNumber || target.trackingNumber,
      carrierName: details?.carrierName || target.carrierName,
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : target.completedAt,
    };

    bookings = [...bookings.slice(0, index), updated, ...bookings.slice(index + 1)];
    persistState();
    emitChange();

    const backendStatus =
      status === 'DISPATCHED_OR_IN_BAY' ? 'PROVIDER_EN_ROUTE'
      : status === 'OUT_FOR_DELIVERY_OR_TESTING' ? 'IN_PROGRESS'
      : status;

    offlineQueue.enqueue(
      'UPDATE_STATUS',
      `/quotations/bookings/${bookingId}/status`,
      'PATCH',
      {
        status: backendStatus,
        metadata: {
          trackingNumber: details?.trackingNumber || target.trackingNumber,
          carrierName: details?.carrierName || target.carrierName,
        },
      },
    );

    weyroNotifications.milestoneAdvanced(updated.trackingNumber, status);

    return updated;
  },

  addBookingReview(
    bookingId: string,
    rating: number,
    comment: string,
  ): BookingRecord | null {
    const index = bookings.findIndex((b) => b.id === bookingId);
    if (index === -1) return null;

    const target = bookings[index];
    const updated: BookingRecord = {
      ...target,
      review: {
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      },
    };

    bookings = [...bookings.slice(0, index), updated, ...bookings.slice(index + 1)];
    persistState();
    emitChange();

    offlineQueue.enqueue(
      'ADD_REVIEW',
      `/quotations/bookings/${bookingId}/reviews`,
      'POST',
      {
        rating,
        comment: comment.trim(),
      },
    );

    return updated;
  },

  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useDamageRequests(): DamageBroadcastRequest[] {
  return useSyncExternalStore(
    damageRequestStore.subscribe,
    damageRequestStore.getRequests,
    damageRequestStore.getRequests,
  );
}

export function useBookings(): BookingRecord[] {
  return useSyncExternalStore(
    damageRequestStore.subscribe,
    damageRequestStore.getBookings,
    damageRequestStore.getBookings,
  );
}

export function useOfflineSyncStatus(): OfflineSyncStatus {
  return offlineQueue.getSnapshot();
}
