import { useSyncExternalStore } from 'react';

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
  status: 'CONFIRMED' | 'IN_TRANSIT' | 'COMPLETED';
  fulfillmentType: string;
  confirmedAt: string;
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
    status: 'QUOTES_RECEIVED',
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
        status: 'PENDING',
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
        status: 'PENDING',
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
    ],
  },
];

let bookings: BookingRecord[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const damageRequestStore = {
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

    // Update quote statuses
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
      confirmedAt: new Date().toISOString(),
    };

    requests = [
      ...requests.slice(0, reqIndex),
      updatedReq,
      ...requests.slice(reqIndex + 1),
    ];
    bookings = [newBooking, ...bookings];

    emitChange();
    return newBooking;
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
