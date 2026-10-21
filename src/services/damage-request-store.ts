import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weyroNotifications } from './notifications';

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

type Listener = () => void;
let listeners: Listener[] = [];

// Seed requests
let requests: DamageBroadcastRequest[] = [
  {
    id: 'req_seed_01',
    customerName: 'Marcus Vance',
    vehicleMake: 'BMW',
    vehicleModel: '330i M-Sport',
    vehicleYear: 2022,
    damagedPart: 'Front Bumper & Headlight Assembly',
    description:
      'Cracked lower valence and damaged LED matrix headlight unit from parking post impact. Need replacement assembly and painting.',
    urgency: 'URGENT',
    fulfillmentType: 'PARTS_SHIPPING',
    damagePhotos: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    ],
    isBroadcast: true,
    broadcastScope: 'BROADCAST_ALL',
    status: 'ACCEPTED',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    quotes: [
      {
        id: 'q_01',
        providerName: 'Apex OEM Auto Dismantlers',
        providerType: 'PARTS_DEALER',
        distanceNote: '120 km away • Nationwide Courier',
        estimatedCost: 1450,
        partCondition: 'OEM',
        eta: '2 business days',
        notes:
          'Genuine OEM LED matrix unit in pristine condition. Includes insured courier shipping.',
        status: 'ACCEPTED',
        createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      },
      {
        id: 'q_02',
        providerName: 'Precision Autobody & Frame',
        providerType: 'GARAGE',
        distanceNote: '8 km away • Local Workshop',
        estimatedCost: 850,
        eta: 'Same day fitment',
        notes:
          'Can fit, align sensor calibration, and blend paint if part is supplied or sourced.',
        status: 'REJECTED',
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
    ],
  },
];

// Seed confirmed booking demonstrating live courier tracking & milestone updates
let bookings: BookingRecord[] = [
  {
    id: 'bk_seed_01',
    requestId: 'req_seed_01',
    quoteId: 'q_01',
    customerName: 'Marcus Vance',
    vehicle: '2022 BMW 330i M-Sport',
    damagedPart: 'Front Bumper & Headlight Assembly',
    providerName: 'Apex OEM Auto Dismantlers',
    providerType: 'PARTS_DEALER',
    totalCost: 1450,
    partCondition: 'OEM',
    eta: '2 business days',
    deliveryAddress: '742 Evergreen Terrace, Springfield',
    scheduledDate: 'Tomorrow by 11:00 AM',
    status: 'DISPATCHED_OR_IN_BAY',
    fulfillmentType: 'PARTS_SHIPPING',
    trackingNumber: 'FDX-88291402US',
    carrierName: 'FedEx Express Freight',
    confirmedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

export interface QueuedMutation {
  id: string;
  type:
    | 'CREATE_REQUEST'
    | 'CREATE_QUOTE'
    | 'ACCEPT_QUOTE'
    | 'UPDATE_STATUS'
    | 'SUBMIT_REVIEW';
  url: string;
  method: 'POST' | 'PATCH' | 'PUT';
  body: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface OfflineSyncStatus {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isOnline: boolean;
  lastError: string | null;
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const QUEUE_STORAGE_KEY = '@weyro/offline_mutation_queue_v1';

function loadPersistedQueue(): QueuedMutation[] {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const data = globalThis.localStorage.getItem(QUEUE_STORAGE_KEY);
      if (data) return JSON.parse(data);
    }
  } catch {
    // Non-blocking catch
  }
  return [];
}

function persistQueue(queue: QueuedMutation[]): void {
  // Asynchronously persist to native cross-platform AsyncStorage
  AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue)).catch(() => {});

  // Synchronously backup to web localStorage if available
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Non-blocking catch
  }
}

let mutationQueue: QueuedMutation[] = loadPersistedQueue();

async function initAsyncStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed: QueuedMutation[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        mutationQueue = parsed;
        emitChange();
        flushMutationQueue().catch(() => {});
      }
    }
  } catch {
    // Non-blocking catch
  }
}

initAsyncStorage().catch(() => {});
let isCurrentlySyncing = false;
let lastSyncedTimestamp: string | null = null;
let lastSyncErrorMessage: string | null = null;
let isNetworkOnline = true;

let currentSyncStatus: OfflineSyncStatus = {
  pendingCount: mutationQueue.length,
  isSyncing: false,
  lastSyncedAt: null,
  isOnline: true,
  lastError: null,
};

function emitChange() {
  currentSyncStatus = {
    pendingCount: mutationQueue.length,
    isSyncing: isCurrentlySyncing,
    lastSyncedAt: lastSyncedTimestamp,
    isOnline: isNetworkOnline,
    lastError: lastSyncErrorMessage,
  };
  for (const listener of listeners) {
    listener();
  }
}

async function flushMutationQueue(): Promise<{ synced: number; failed: number }> {
  if (mutationQueue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const item of mutationQueue) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        synced++;
      } else {
        item.retryCount += 1;
        item.lastError = `HTTP ${res.status}: ${res.statusText}`;
        remaining.push(item);
        failed++;
      }
    } catch (err: any) {
      item.retryCount += 1;
      item.lastError = err?.message || 'Network unreachable';
      remaining.push(item);
      failed++;
      isNetworkOnline = false;
      break; // Stop draining if network is dropped
    }
  }

  mutationQueue = remaining;
  persistQueue(mutationQueue);
  emitChange();

  return { synced, failed };
}

function enqueueMutation(
  type: QueuedMutation['type'],
  url: string,
  method: QueuedMutation['method'],
  body: Record<string, unknown>
): void {
  const item: QueuedMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    url,
    method,
    body,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  mutationQueue.push(item);
  persistQueue(mutationQueue);
  emitChange();

  // Attempt immediate background flush
  flushMutationQueue().catch(() => {});
}

function mapBackendRequest(raw: any): DamageBroadcastRequest {
  return {
    id: raw.id,
    customerName: raw.customer
      ? `${raw.customer.firstName || ''} ${raw.customer.lastName || ''}`.trim()
      : raw.customerName || 'Customer',
    vehicleMake: raw.vehicle?.make || raw.vehicleMake || 'Unknown',
    vehicleModel: raw.vehicle?.model || raw.vehicleModel || 'Vehicle',
    vehicleYear: raw.vehicle?.year || raw.vehicleYear || new Date().getFullYear(),
    damagedPart: raw.title || raw.damagedPart || 'Damaged Component',
    description: raw.description || '',
    urgency: raw.urgency || 'NORMAL',
    fulfillmentType: raw.fulfillmentType || 'PARTS_SHIPPING',
    damagePhotos: raw.damagePhotos || [],
    isBroadcast: true,
    broadcastScope: 'BROADCAST_ALL',
    status: raw.status || 'OPEN',
    quotes: (raw.quotations || raw.quotes || []).map((q: any) => ({
      id: q.id,
      providerName: q.providerName || q.provider?.businessName || 'Provider',
      providerType: q.providerType || q.provider?.providerType || 'MECHANIC',
      distanceNote: q.distanceNote || 'Verified Provider',
      estimatedCost: Number(q.totalCost || q.estimatedCost || 0),
      partCondition: q.partCondition,
      eta: q.etaDescription || q.eta || 'Standard ETA',
      notes: q.notes || '',
      status: q.status || 'PENDING',
      createdAt: q.createdAt || new Date().toISOString(),
    })),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function mapBackendBooking(raw: any): BookingRecord {
  return {
    id: raw.id,
    requestId: raw.requestId || raw.quotation?.requestId || 'req_01',
    quoteId: raw.quotationId || raw.quoteId || 'q_01',
    customerName: raw.customer
      ? `${raw.customer.firstName || ''} ${raw.customer.lastName || ''}`.trim()
      : raw.customerName || 'Customer',
    vehicle: raw.vehicle || 'Vehicle',
    damagedPart: raw.damagedPart || 'Auto Service Booking',
    providerName: raw.providerName || raw.provider?.businessName || 'Provider',
    providerType: raw.providerType || raw.provider?.providerType || 'GARAGE',
    totalCost: Number(raw.totalCost || raw.quotation?.totalCost || 0),
    partCondition: raw.partCondition || raw.quotation?.partCondition,
    eta: raw.eta || raw.quotation?.etaDescription || 'In Progress',
    deliveryAddress: raw.deliveryAddress || 'Customer Address',
    scheduledDate: raw.scheduledDate || 'Scheduled',
    status: (raw.status as BookingMilestoneStatus) || 'CONFIRMED',
    fulfillmentType: raw.fulfillmentType || 'PARTS_SHIPPING',
    trackingNumber: raw.trackingNumber,
    carrierName: raw.carrierName,
    review: raw.review,
    confirmedAt: raw.createdAt || raw.confirmedAt || new Date().toISOString(),
    completedAt: raw.completedAt,
  };
}

async function syncWithBackend(): Promise<void> {
  if (isCurrentlySyncing) return;
  isCurrentlySyncing = true;
  emitChange();

  try {
    // 1. Drain pending offline mutation queue first
    await flushMutationQueue();

    // 2. Fetch fresh feed from backend
    const [reqRes, bkRes] = await Promise.all([
      fetch(`${API_BASE_URL}/damage-requests/broadcast-feed`),
      fetch(`${API_BASE_URL}/bookings`),
    ]);

    if (reqRes.ok) {
      const serverRequests = await reqRes.json();
      const rawList = Array.isArray(serverRequests)
        ? serverRequests
        : serverRequests?.items || [];
      if (rawList.length > 0) {
        const mapped = rawList.map(mapBackendRequest);
        const existingIds = new Set(mapped.map((r: any) => r.id));
        const localOnly = requests.filter((r) => !existingIds.has(r.id));
        requests = [...localOnly, ...mapped];
      }
    }

    if (bkRes.ok) {
      const serverBookings = await bkRes.json();
      const rawList = Array.isArray(serverBookings)
        ? serverBookings
        : serverBookings?.items || [];
      if (rawList.length > 0) {
        const mapped = rawList.map(mapBackendBooking);
        const existingIds = new Set(mapped.map((b: any) => b.id));
        const localOnly = bookings.filter((b) => !existingIds.has(b.id));
        bookings = [...localOnly, ...mapped];
      }
    }

    isNetworkOnline = true;
    lastSyncedTimestamp = new Date().toISOString();
    lastSyncErrorMessage = null;
  } catch (err: any) {
    isNetworkOnline = false;
    lastSyncErrorMessage = err?.message || 'Offline mode: maintaining local state';
  } finally {
    isCurrentlySyncing = false;
    emitChange();
  }
}

let syncInitiated = false;

export const damageRequestStore = {
  syncWithBackend,

  getRequests(): DamageBroadcastRequest[] {
    return requests;
  },

  getBookings(): BookingRecord[] {
    return bookings;
  },

  addRequest(
    data: Omit<
      DamageBroadcastRequest,
      'id' | 'createdAt' | 'status' | 'quotes' | 'isBroadcast' | 'broadcastScope'
    >
  ): DamageBroadcastRequest {
    const newReq: DamageBroadcastRequest = {
      ...data,
      id: `req_${Date.now()}`,
      isBroadcast: true,
      broadcastScope: 'BROADCAST_ALL',
      status: 'OPEN',
      quotes: [],
      createdAt: new Date().toISOString(),
    };
    requests = [newReq, ...requests];
    emitChange();

    // Enqueue durable offline mutation
    enqueueMutation('CREATE_REQUEST', `${API_BASE_URL}/damage-requests`, 'POST', {
      title: data.damagedPart,
      description: data.description,
      urgency: data.urgency,
      fulfillmentType: data.fulfillmentType,
      damagePhotos: data.damagePhotos,
      isBroadcast: true,
      address: 'Nationwide Broadcast',
      latitude: 40.7128,
      longitude: -74.006,
      vehicle: {
        make: data.vehicleMake,
        model: data.vehicleModel,
        year: data.vehicleYear,
      },
    });

    return newReq;
  },

  addQuote(
    requestId: string,
    quote: Omit<DamageRequestQuote, 'id' | 'createdAt' | 'status'>
  ): DamageRequestQuote | null {
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) return null;

    const newQuote: DamageRequestQuote = {
      ...quote,
      id: `q_${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const targetReq = requests[reqIndex];
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
    emitChange();

    enqueueMutation(
      'CREATE_QUOTE',
      `${API_BASE_URL}/damage-requests/${requestId}/quotations`,
      'POST',
      {
        providerName: quote.providerName,
        providerType: quote.providerType,
        totalCost: quote.estimatedCost,
        partCondition: quote.partCondition,
        etaDescription: quote.eta,
        notes: quote.notes,
      }
    );

    weyroNotifications.quoteReceived(
      quote.providerName,
      targetReq.damagedPart,
      quote.estimatedCost
    );

    return newQuote;
  },

  acceptQuote(
    requestId: string,
    quoteId: string,
    details: { deliveryAddress: string; scheduledDate: string }
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
          ? `FDX-${Math.floor(10000000 + Math.random() * 90000000)}US`
          : undefined,
      carrierName:
        targetReq.fulfillmentType === 'PARTS_SHIPPING'
          ? 'Insured Auto Express'
          : undefined,
      confirmedAt: new Date().toISOString(),
    };

    requests = [
      ...requests.slice(0, reqIndex),
      updatedReq,
      ...requests.slice(reqIndex + 1),
    ];
    bookings = [newBooking, ...bookings];

    emitChange();

    enqueueMutation(
      'ACCEPT_QUOTE',
      `${API_BASE_URL}/quotations/${acceptedQuote.id}/accept`,
      'POST',
      {
        deliveryAddress: details.deliveryAddress,
        scheduledDate: details.scheduledDate,
      }
    );

    return newBooking;
  },

  updateBookingStatus(
    bookingId: string,
    status: BookingMilestoneStatus,
    details?: { trackingNumber?: string; carrierName?: string }
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
    emitChange();

    enqueueMutation(
      'UPDATE_STATUS',
      `${API_BASE_URL}/bookings/${bookingId}/status`,
      'PATCH',
      {
        status,
        trackingNumber: details?.trackingNumber || target.trackingNumber,
        carrierName: details?.carrierName || target.carrierName,
      }
    );

    weyroNotifications.milestoneAdvanced(
      updated.trackingNumber,
      status
    );

    return updated;
  },

  addBookingReview(
    bookingId: string,
    rating: number,
    comment: string
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
    emitChange();

    enqueueMutation(
      'SUBMIT_REVIEW',
      `${API_BASE_URL}/bookings/${bookingId}/reviews`,
      'POST',
      {
        rating,
        comment: comment.trim(),
      }
    );

    return updated;
  },

  getPendingMutations(): QueuedMutation[] {
    return [...mutationQueue];
  },

  getSyncStatus(): OfflineSyncStatus {
    return currentSyncStatus;
  },

  flushQueue(): Promise<{ synced: number; failed: number }> {
    return flushMutationQueue();
  },

  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    if (!syncInitiated) {
      syncInitiated = true;
      syncWithBackend().catch(() => {});
    }
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useDamageRequests(): DamageBroadcastRequest[] {
  return useSyncExternalStore(
    damageRequestStore.subscribe,
    damageRequestStore.getRequests,
    damageRequestStore.getRequests
  );
}

export function useBookings(): BookingRecord[] {
  return useSyncExternalStore(
    damageRequestStore.subscribe,
    damageRequestStore.getBookings,
    damageRequestStore.getBookings
  );
}

export function useOfflineSyncStatus(): OfflineSyncStatus {
  return useSyncExternalStore(
    damageRequestStore.subscribe,
    damageRequestStore.getSyncStatus,
    damageRequestStore.getSyncStatus
  );
}

