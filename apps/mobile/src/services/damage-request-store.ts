import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weyroNotifications } from './notifications';
import { ApiClientError, apiClient } from './api-client';
import { offlineQueue, OfflineSyncStatus } from './offline-queue';

export interface DamageRequestQuote {
  id: string;
  providerId: string;
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

export type ServiceCategory =
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'SPARE_PART'
  | 'TOWING'
  | 'ROADSIDE'
  | 'INSPECTION';

export type FulfillmentType =
  | 'WORKSHOP_VISIT'
  | 'ON_SITE'
  | 'PARTS_SHIPPING'
  | 'TOW_TO_GARAGE';

export interface DamageBroadcastRequest {
  id: string;
  customerName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  category: ServiceCategory;
  damagedPart: string;
  description: string;
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  fulfillmentType: FulfillmentType;
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
  providerId: string;
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
  fulfillmentType: FulfillmentType;
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

function mapQuote(q: any): DamageRequestQuote {
  return {
    id: q.id,
    providerId: q.providerId || q.provider?.id || '',
    providerName: q.provider?.businessName || 'Provider',
    providerType: q.provider?.providerType || 'GARAGE',
    distanceNote: q.provider?.address || 'Local workshop',
    estimatedCost: Number(q.totalCost) || 0,
    partCondition: q.partCondition,
    eta: q.etaDescription || '1-2 days',
    notes: q.notes || '',
    status: q.status,
    createdAt: q.createdAt,
  };
}

function mapRequest(item: any): DamageBroadcastRequest {
  return {
    id: item.id,
    customerName: `${item.customer?.firstName || 'Customer'} ${
      item.customer?.lastName || ''
    }`.trim(),
    vehicleMake: item.vehicle?.make || 'Unknown',
    vehicleModel: item.vehicle?.model || 'Vehicle',
    vehicleYear: item.vehicle?.year || new Date().getFullYear(),
    category: item.category || 'REPAIR',
    damagedPart: item.title,
    description: item.description,
    urgency: item.urgency,
    fulfillmentType: item.fulfillmentType || 'WORKSHOP_VISIT',
    damagePhotos: (item.media || []).map((m: any) => m.url),
    isBroadcast: true,
    broadcastScope: 'BROADCAST_ALL',
    status: item.status,
    quotes: (item.quotations || []).map(mapQuote),
    createdAt: item.createdAt,
  };
}

function mapBooking(b: any): BookingRecord {
  const rawStatus = b.status;
  return {
    id: b.id,
    requestId: b.quotation?.requestId || b.quotation?.request?.id || '',
    quoteId: b.quotationId || b.quotation?.id || '',
    providerId: b.providerId || b.provider?.id || '',
    customerName: `${b.customer?.firstName || 'Customer'} ${
      b.customer?.lastName || ''
    }`.trim(),
    vehicle: `${b.quotation?.request?.vehicle?.year || ''} ${
      b.quotation?.request?.vehicle?.make || ''
    } ${b.quotation?.request?.vehicle?.model || ''}`.trim(),
    damagedPart: b.quotation?.request?.title || 'Automotive Service',
    providerName: b.provider?.businessName || 'Provider',
    providerType: b.provider?.providerType || 'GARAGE',
    totalCost: Number(b.quotation?.totalCost) || 0,
    partCondition: b.quotation?.partCondition,
    eta: b.quotation?.etaDescription || 'Confirmed',
    deliveryAddress: b.completionNotes || b.provider?.address || 'Workshop',
    scheduledDate: b.scheduledAt,
    status:
      rawStatus === 'PROVIDER_EN_ROUTE'
        ? 'DISPATCHED_OR_IN_BAY'
        : rawStatus === 'IN_PROGRESS'
          ? 'OUT_FOR_DELIVERY_OR_TESTING'
          : (rawStatus as BookingMilestoneStatus),
    fulfillmentType:
      b.quotation?.request?.fulfillmentType || 'WORKSHOP_VISIT',
    review: b.review
      ? {
          rating: b.review.rating,
          comment: b.review.comment || '',
          createdAt: b.review.createdAt,
        }
      : undefined,
    confirmedAt: b.createdAt,
    completedAt: b.completedAt,
    trackingNumber: b.trackingNumber || undefined,
    carrierName: b.carrierName || undefined,
  };
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function shouldQueue(err: unknown): boolean {
  if (!(err instanceof ApiClientError)) return true;
  return err.status === 0 || err.status >= 500;
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
      // Customers load their own requests; providers load the broadcast feed.
      // Both calls are attempted and merged so BOTH-role users see everything.
      const [mine, feed, bookingsRes] = await Promise.allSettled([
        apiClient.get<any>('/damage-requests/my'),
        apiClient.get<any>('/damage-requests/feed'),
        apiClient.get<any>('/quotations/bookings'),
      ]);

      const byId = new Map<string, DamageBroadcastRequest>();

      if (mine.status === 'fulfilled' && Array.isArray(mine.value?.items)) {
        for (const item of mine.value.items) {
          const mapped = mapRequest(item);
          byId.set(mapped.id, mapped);
        }
      }

      if (feed.status === 'fulfilled' && Array.isArray(feed.value?.items)) {
        for (const item of feed.value.items) {
          const mapped = mapRequest(item);
          // Prefer the customer view (all quotes) when the request already exists.
          if (!byId.has(mapped.id)) byId.set(mapped.id, mapped);
        }
      }

      if (byId.size > 0 || mine.status === 'fulfilled' || feed.status === 'fulfilled') {
        requests = sortByCreatedAtDesc([...byId.values()]);
      }

      if (
        bookingsRes.status === 'fulfilled' &&
        Array.isArray(bookingsRes.value?.items)
      ) {
        bookings = bookingsRes.value.items.map(mapBooking);
      }

      await persistState();
      emitChange();
    } finally {
      isSyncing = false;
    }
  },

  async createBroadcastRequest(params: {
    customerName: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    category: ServiceCategory;
    damagedPart: string;
    description: string;
    urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
    fulfillmentType: FulfillmentType;
    damagePhotos: string[];
    latitude: number;
    longitude: number;
    address: string;
  }): Promise<DamageBroadcastRequest> {
    const created = await apiClient.post<any>('/damage-requests', {
      vehicleMake: params.vehicleMake,
      vehicleModel: params.vehicleModel,
      vehicleYear: params.vehicleYear,
      category: params.category,
      title: params.damagedPart,
      description: params.description,
      urgency: params.urgency,
      fulfillmentType: params.fulfillmentType,
      latitude: params.latitude,
      longitude: params.longitude,
      address: params.address,
      mediaUrls: params.damagePhotos,
    });

    const newReq: DamageBroadcastRequest = {
      ...mapRequest(created),
      customerName: params.customerName,
    };

    requests = [newReq, ...requests.filter((r) => r.id !== newReq.id)];
    await persistState();
    emitChange();

    return newReq;
  },

  async submitQuote(
    requestId: string,
    quote: {
      providerName: string;
      providerType: 'MECHANIC' | 'PARTS_DEALER' | 'GARAGE';
      estimatedCost: number;
      partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
      eta: string;
      notes: string;
    },
  ): Promise<DamageRequestQuote | null> {
    if (!requests.some((r) => r.id === requestId)) return null;

    const created = await apiClient.post<any>(
      `/damage-requests/${requestId}/quotations`,
      {
        partsCost: Math.round(quote.estimatedCost * 0.7),
        labourCost: Math.round(quote.estimatedCost * 0.2),
        shippingCost: Math.round(quote.estimatedCost * 0.1),
        partCondition: quote.partCondition,
        etaDescription: quote.eta,
        notes: quote.notes,
      },
    );

    const newQuote = mapQuote(created);

    requests = requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'QUOTES_RECEIVED',
            quotes: [newQuote, ...r.quotes.filter((q) => q.id !== newQuote.id)],
          }
        : r,
    );

    await persistState();
    emitChange();

    return newQuote;
  },

  async acceptQuote(
    requestId: string,
    quoteId: string,
    details: { deliveryAddress: string; scheduledDate: string },
  ): Promise<BookingRecord | null> {
    const targetReq = requests.find((r) => r.id === requestId);
    if (!targetReq) return null;
    const acceptedQuote = targetReq.quotes.find((q) => q.id === quoteId);
    if (!acceptedQuote) return null;

    const created = await apiClient.post<any>(
      `/quotations/${quoteId}/accept`,
      {
        scheduledDate: details.scheduledDate,
        deliveryAddress: details.deliveryAddress,
        notes: details.deliveryAddress,
      },
    );

    const newBooking: BookingRecord = {
      ...mapBooking(created),
      requestId,
      quoteId,
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
      fulfillmentType: targetReq.fulfillmentType,
    };

    requests = requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'ACCEPTED',
            quotes: r.quotes.map((q) => ({
              ...q,
              status: q.id === quoteId ? 'ACCEPTED' : 'REJECTED',
            })),
          }
        : r,
    );
    bookings = [newBooking, ...bookings.filter((b) => b.id !== newBooking.id)];

    await persistState();
    emitChange();

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
      completedAt:
        status === 'COMPLETED' ? new Date().toISOString() : target.completedAt,
    };

    bookings = [
      ...bookings.slice(0, index),
      updated,
      ...bookings.slice(index + 1),
    ];
    persistState();
    emitChange();

    const backendStatus =
      status === 'DISPATCHED_OR_IN_BAY'
        ? 'PROVIDER_EN_ROUTE'
        : status === 'OUT_FOR_DELIVERY_OR_TESTING'
          ? 'IN_PROGRESS'
          : status;

    const body = {
      status: backendStatus,
      trackingNumber: details?.trackingNumber || target.trackingNumber,
      carrierName: details?.carrierName || target.carrierName,
    };

    apiClient
      .patch(`/quotations/bookings/${bookingId}/status`, body)
      .catch((err) => {
        if (shouldQueue(err)) {
          offlineQueue.enqueue(
            'UPDATE_STATUS',
            `/quotations/bookings/${bookingId}/status`,
            'PATCH',
            body,
          );
        }
      });

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

    bookings = [
      ...bookings.slice(0, index),
      updated,
      ...bookings.slice(index + 1),
    ];
    persistState();
    emitChange();

    const body = { rating, comment: comment.trim() };

    apiClient
      .post(`/quotations/bookings/${bookingId}/reviews`, body)
      .catch((err) => {
        if (shouldQueue(err)) {
          offlineQueue.enqueue(
            'ADD_REVIEW',
            `/quotations/bookings/${bookingId}/reviews`,
            'POST',
            body,
          );
        }
      });

    return updated;
  },

  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  async clearLocalState(): Promise<void> {
    requests = [];
    bookings = [];
    emitChange();
    try {
      await Promise.all([
        AsyncStorage.removeItem(REQUESTS_CACHE_KEY),
        AsyncStorage.removeItem(BOOKINGS_CACHE_KEY),
      ]);
    } catch {
      // Non-blocking cache clear error
    }
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
