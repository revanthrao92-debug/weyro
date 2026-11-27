import { BadRequestException, NotFoundException } from '@nestjs/common';
import { parseRef } from '@weyro/api-contracts';
import type { PrismaService } from '../../prisma/prisma.service';
import { buildTimeline, type TimelineLine } from './timeline';

/**
 * Everything an admin needs about one record, found by its Weyro reference number:
 * summary, people, money, details, the timeline from the event history, live location for
 * active jobs and trips, linked numbers and the actions that apply. Personal details here come
 * from the live tables (admin only), never from the event history.
 */

type Row = { label: string; value: string };
type Section = { title: string; rows: Row[] };
type Person = { role: string; name: string; phone?: string | null; email?: string | null };

export type RecordDetail = {
  ref: string;
  type: string;
  label: string;
  title: string;
  status: string;
  amount: number | null;
  createdAt: string;
  people: Person[];
  sections: Section[];
  timeline: TimelineLine[];
  location: { latitude: number; longitude: number; updatedAt: string; label: string } | null;
  linked: { ref: string; label: string }[];
  actions: { refund?: { kind: 'order' | 'booking'; id: string; amount: number }; jobId?: string; jobStatus?: string };
};

const money = (v: unknown) =>
  v === null || v === undefined ? null : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d?: Date | null) =>
  d
    ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
const words = (v?: string | null) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : null);
const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Customer';
/** Keep only rows that have a value. */
const rows = (...pairs: [string, string | number | null | undefined][]): Row[] =>
  pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => ({ label, value: String(value) }));
const LABEL: Record<string, string> = {
  R: 'Request', Q: 'Quote', J: 'Job', O: 'Parts order', T: 'Driver trip', P: 'Payment', F: 'Refund',
};
const ACTIVE_JOB = ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'];
const ACTIVE_TRIP = ['CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];
const vehicle = (v?: { make?: string | null; model?: string | null; year?: number | null } | null) =>
  v?.make ? [v.make, v.model, v.year].filter(Boolean).join(' ') : null;

export async function recordDetail(prisma: PrismaService, text: string): Promise<RecordDetail> {
  const parsed = parseRef(text);
  if (!parsed) {
    throw new BadRequestException(
      'That is not a valid Weyro reference. Check the letters and numbers (like J-261127-0042-6) and try again.',
    );
  }
  const { ref, type } = parsed;
  const notFound = () => new NotFoundException(`No ${LABEL[type].toLowerCase()} has the reference ${ref}.`);
  const userContact = { select: { email: true, phone: true } } as const;
  let d: Omit<RecordDetail, 'timeline' | 'ref' | 'type' | 'label'>;

  switch (type) {
    case 'J': {
      const b = await prisma.booking.findUnique({
        where: { ref },
        include: {
          customer: { include: { user: userContact } },
          provider: { include: { user: userContact } },
          quotation: { include: { request: true } },
          payments: { include: { refunds: true } },
          review: true,
        },
      });
      if (!b) throw notFound();
      const q = b.quotation;
      const r = q.request;
      const paid = b.payments.find((p) => ['AUTHORIZED', 'CAPTURED', 'RELEASED'].includes(p.status));
      d = {
        title: r.title,
        status: b.status,
        amount: Number(q.totalCost),
        createdAt: b.createdAt.toISOString(),
        people: [
          { role: 'Customer', name: fullName(b.customer), phone: b.customer.user?.phone, email: b.customer.user?.email },
          { role: words(b.provider.providerType) ?? 'Provider', name: b.provider.businessName, phone: b.provider.phone, email: b.provider.user?.email },
        ],
        sections: [
          {
            title: 'Money',
            rows: rows(
              ['Quote total', money(q.totalCost)],
              ['Parts', money(q.partsCost)],
              ['Labour', money(q.labourCost)],
              ['Delivery', Number(q.shippingCost) ? money(q.shippingCost) : null],
              ...b.payments.map((p): [string, string] => [`Payment ${p.ref}`, `${money(p.amount)}, ${words(p.status)}`]),
              ...b.payments.flatMap((p) => p.refunds.map((f): [string, string] => [`Refund ${f.ref}`, `${money(f.amount)}, ${words(f.status)}`])),
            ),
          },
          {
            title: 'Job',
            rows: rows(
              ['Category', words(r.category)],
              ['Urgency', words(r.urgency)],
              ['Vehicle', vehicle({ make: r.vehicleMake, model: r.vehicleModel, year: r.vehicleYear })],
              ['Customer location', r.address],
              ['Scheduled', when(b.scheduledAt)],
              ['Started', when(b.startedAt)],
              ['Completed', when(b.completedAt)],
              ['Warranty', q.warrantyDays ? `${q.warrantyDays} days` : null],
              ['Quoted time', q.etaDescription],
              ['Part condition', words(q.partCondition)],
              ['Courier', [b.carrierName, b.trackingNumber].filter(Boolean).join(', ') || null],
              ['Provider notes', q.notes],
              ['Completion notes', b.completionNotes],
              ['Review', b.review ? `${b.review.rating} of 5${b.review.comment ? `: ${b.review.comment}` : ''}` : null],
            ),
          },
          { title: 'What the customer wrote', rows: rows(['Request', r.description]) },
        ],
        location:
          ACTIVE_JOB.includes(b.status) && b.providerLatitude !== null && b.providerLongitude !== null && b.providerLocationUpdatedAt
            ? {
                latitude: b.providerLatitude,
                longitude: b.providerLongitude,
                updatedAt: b.providerLocationUpdatedAt.toISOString(),
                label: `${b.provider.businessName}, last known position`,
              }
            : null,
        linked: [
          { ref: r.ref, label: 'Request' },
          { ref: q.ref, label: 'Quote' },
          ...b.payments.map((p) => ({ ref: p.ref, label: 'Payment' })),
          ...b.payments.flatMap((p) => p.refunds.map((f) => ({ ref: f.ref, label: 'Refund' }))),
        ],
        actions: {
          jobId: b.id,
          jobStatus: b.status,
          ...(paid ? { refund: { kind: 'booking' as const, id: b.id, amount: Number(paid.amount) } } : {}),
        },
      };
      break;
    }
    case 'O': {
      const o = await prisma.sparePartOrder.findUnique({
        where: { ref },
        include: { customer: { include: { user: userContact } }, provider: { include: { user: userContact } }, sparePart: true },
      });
      if (!o) throw notFound();
      d = {
        title: `${o.quantity} × ${o.sparePart.name}`,
        status: o.status,
        amount: Number(o.totalAmount),
        createdAt: o.createdAt.toISOString(),
        people: [
          { role: 'Customer', name: fullName(o.customer), phone: o.customer.user?.phone, email: o.customer.user?.email },
          { role: 'Dealer', name: o.provider.businessName, phone: o.provider.phone, email: o.provider.user?.email },
        ],
        sections: [
          {
            title: 'Money',
            rows: rows(['Price each', money(o.unitPrice)], ['Quantity', o.quantity], ['Total', money(o.totalAmount)], ['Paid', when(o.paidAt)], ['Refunded', when(o.refundedAt)]),
          },
          {
            title: 'Delivery',
            rows: rows(
              ['Delivery status', words(o.fulfillmentStatus)],
              ['Shipped', when(o.shippedAt)],
              ['Delivered', when(o.deliveredAt)],
              ['Courier', o.carrierName],
              ['Tracking number', o.trackingNumber],
              ['Deliver to', [o.shippingName, o.shippingAddress, o.shippingCity, o.shippingPincode].filter(Boolean).join(', ') || null],
              ['Delivery phone', o.shippingPhone],
              ['Dealer notes', o.dealerNotes],
            ),
          },
          {
            title: 'Part',
            rows: rows(
              ['Part', o.sparePart.name],
              ['Part number', o.sparePart.partNumber],
              ['Condition', words(o.sparePart.condition)],
              ['Fits', o.sparePart.compatibleMakes.join(', ') || null],
            ),
          },
        ],
        location: null,
        linked: [],
        actions: o.status === 'PAID' ? { refund: { kind: 'order', id: o.id, amount: Number(o.totalAmount) } } : {},
      };
      break;
    }
    case 'T': {
      const t = await prisma.driverBooking.findUnique({
        where: { ref },
        include: { customer: { include: { user: userContact } }, driver: { include: { user: userContact } }, vehicle: true },
      });
      if (!t) throw notFound();
      d = {
        title: t.pickupAddress,
        status: t.status,
        amount: Number(t.totalAmount),
        createdAt: t.createdAt.toISOString(),
        people: [
          { role: 'Customer', name: fullName(t.customer), phone: t.customer.user?.phone, email: t.customer.user?.email },
          { role: 'Driver', name: t.driver.businessName, phone: t.driver.phone, email: t.driver.user?.email },
        ],
        sections: [
          {
            title: 'Money',
            rows: rows(['Customer pays', money(t.totalAmount)], ['Platform fee', money(t.platformFee)], ['Driver earns', money(t.driverEarning)]),
          },
          {
            title: 'Trip',
            rows: rows(
              ['Pickup', t.pickupAddress],
              ['Destination', t.destinationAddress],
              ['Starts', when(t.startAt)],
              ['Ends', when(t.endAt)],
              ['Length', t.durationDays ? `${t.durationDays} day(s)` : t.durationHours ? `${t.durationHours} hours` : null],
              ['Vehicle', vehicle(t.vehicle)],
              ['Transmission', words(t.transmission)],
              ['Cancelled because', t.cancellationReason],
            ),
          },
        ],
        location:
          ACTIVE_TRIP.includes(t.status) && t.driverLatitude !== null && t.driverLongitude !== null && t.driverLocationUpdatedAt
            ? {
                latitude: t.driverLatitude,
                longitude: t.driverLongitude,
                updatedAt: t.driverLocationUpdatedAt.toISOString(),
                label: `${t.driver.businessName}, last known position`,
              }
            : null,
        linked: [],
        actions: {},
      };
      break;
    }
    case 'R': {
      const r = await prisma.serviceRequest.findUnique({
        where: { ref },
        include: {
          customer: { include: { user: userContact } },
          quotations: { include: { provider: { select: { businessName: true } }, booking: { select: { ref: true } } } },
        },
      });
      if (!r) throw notFound();
      d = {
        title: r.title,
        status: r.status,
        amount: null,
        createdAt: r.createdAt.toISOString(),
        people: [{ role: 'Customer', name: fullName(r.customer), phone: r.customer.user?.phone, email: r.customer.user?.email }],
        sections: [
          {
            title: 'Request',
            rows: rows(
              ['Category', words(r.category)],
              ['Urgency', words(r.urgency)],
              ['Vehicle', vehicle({ make: r.vehicleMake, model: r.vehicleModel, year: r.vehicleYear })],
              ['Location', r.address],
              ['Quotes until', when(r.quotesUntil)],
              ['Closes', when(r.expiresAt)],
            ),
          },
          { title: 'What the customer wrote', rows: rows(['Description', r.description]) },
          {
            title: `Quotes (${r.quotations.length})`,
            rows: r.quotations.map((q) => ({ label: `${q.provider.businessName}`, value: `${money(q.totalCost)}, ${words(q.status)}` })),
          },
        ],
        location: null,
        linked: [
          ...r.quotations.map((q) => ({ ref: q.ref, label: 'Quote' })),
          ...r.quotations.filter((q) => q.booking).map((q) => ({ ref: q.booking!.ref, label: 'Job' })),
        ],
        actions: {},
      };
      break;
    }
    case 'Q': {
      const q = await prisma.quotation.findUnique({
        where: { ref },
        include: { provider: { include: { user: userContact } }, request: true, booking: { select: { ref: true } } },
      });
      if (!q) throw notFound();
      d = {
        title: q.request.title,
        status: q.status,
        amount: Number(q.totalCost),
        createdAt: q.createdAt.toISOString(),
        people: [{ role: words(q.provider.providerType) ?? 'Provider', name: q.provider.businessName, phone: q.provider.phone, email: q.provider.user?.email }],
        sections: [
          {
            title: 'Quote',
            rows: rows(
              ['Total', money(q.totalCost)],
              ['Parts', money(q.partsCost)],
              ['Labour', money(q.labourCost)],
              ['Delivery', Number(q.shippingCost) ? money(q.shippingCost) : null],
              ['Time', q.etaDescription],
              ['Warranty', q.warrantyDays ? `${q.warrantyDays} days` : null],
              ['Part condition', words(q.partCondition)],
              ['Notes', q.notes],
            ),
          },
        ],
        location: null,
        linked: [{ ref: q.request.ref, label: 'Request' }, ...(q.booking ? [{ ref: q.booking.ref, label: 'Job' }] : [])],
        actions: {},
      };
      break;
    }
    case 'P': {
      const p = await prisma.payment.findUnique({ where: { ref }, include: { booking: { select: { ref: true } }, refunds: true } });
      if (!p) throw notFound();
      d = {
        title: 'Payment',
        status: p.status,
        amount: Number(p.amount),
        createdAt: p.createdAt.toISOString(),
        people: [],
        sections: [
          {
            title: 'Payment',
            rows: rows(
              ['Amount', money(p.amount)],
              ['Method', words(p.method)],
              ['Paid', when(p.paidAt)],
              ['Paid out to provider', when(p.paidToProviderAt)],
              ['Payout reference', p.payoutReference],
            ),
          },
        ],
        location: null,
        linked: [{ ref: p.booking.ref, label: 'Job' }, ...p.refunds.map((f) => ({ ref: f.ref, label: 'Refund' }))],
        actions: {},
      };
      break;
    }
    case 'F': {
      const f = await prisma.refund.findUnique({ where: { ref }, include: { payment: { include: { booking: { select: { ref: true } } } } } });
      if (!f) throw notFound();
      d = {
        title: 'Refund',
        status: f.status,
        amount: Number(f.amount),
        createdAt: f.createdAt.toISOString(),
        people: [],
        sections: [{ title: 'Refund', rows: rows(['Amount', money(f.amount)], ['Reason', f.reason], ['Problem', f.failureReason]) }],
        location: null,
        linked: [
          { ref: f.payment.ref, label: 'Payment' },
          { ref: f.payment.booking.ref, label: 'Job' },
        ],
        actions: {},
      };
      break;
    }
  }

  // Timeline: this record plus everything linked to it, oldest first.
  const refs = [ref, ...d!.linked.map((l) => l.ref)];
  const events = await prisma.event.findMany({ where: { entityRef: { in: refs } }, orderBy: { seq: 'asc' } });
  return {
    ref,
    type,
    label: LABEL[type],
    ...d!,
    sections: d!.sections.filter((s) => s.rows.length > 0),
    timeline: buildTimeline(events),
  };
}
