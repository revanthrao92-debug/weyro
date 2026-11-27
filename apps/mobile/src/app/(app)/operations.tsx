import { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Package, Wrench } from 'lucide-react-native';
import {
  useAdminBookings,
  useAdminOrders,
  useAdminRefundBooking,
  useAdminRefundOrder,
  type AdminBooking,
  type AdminOrder,
} from '@/hooks/useAdmin';
import { useUpdateBookingStatus } from '@/hooks/useBookings';
import {
  Button,
  Chip,
  EmptyState,
  PressableScale,
  ScreenContainer,
  Skeleton,
  StatusPill,
  ErrorState,
  PageHeader,
} from '@/components/ui';
import { confirmAction, notice } from '@/lib/confirm';
import { formatDate, titleize, bookingStatusTone, formatRupees, refOf } from '@/utils/format';
import { palette, spacing, typography, type StatusTone } from '@/theme';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { RefSearch } from '@/components/admin/RefSearch';

const ORDER_FILTERS = ['ALL', 'PAID', 'PENDING', 'REFUNDED'] as const;
const JOB_FILTERS = ['ALL', 'ACTIVE', 'DISPUTED', 'COMPLETED', 'CANCELLED'] as const;
type Segment = 'orders' | 'jobs';

function orderTone(status: string): StatusTone {
  if (status === 'PAID') return 'success';
  if (status === 'REFUNDED') return 'danger';
  if (status === 'CANCELLED' || status === 'FAILED') return 'danger';
  return 'warning';
}


function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PROVIDER_EN_ROUTE: 'On the way',
    IN_PROGRESS: 'In progress',
    PENDING: 'To pack',
  };
  return labels[status] ?? titleize(status);
}

export default function OperationsScreen() {
  const [segment, setSegment] = useState<Segment>('orders');
  const [orderFilter, setOrderFilter] =
    useState<(typeof ORDER_FILTERS)[number]>('ALL');
  const [jobFilter, setJobFilter] = useState<(typeof JOB_FILTERS)[number]>('ALL');

  const ordersQuery = useAdminOrders();
  const bookingsQuery = useAdminBookings();
  const ordersRefresh = useRefreshControl(ordersQuery.refetch);
  const bookingsRefresh = useRefreshControl(bookingsQuery.refetch);
  const refundOrder = useAdminRefundOrder();
  const refundBooking = useAdminRefundBooking();
  const updateBooking = useUpdateBookingStatus();
  const refundGuard = useRef(false);

  const orders = (ordersQuery.data?.items ?? []).filter((order) =>
    orderFilter === 'ALL' ? true : order.status === orderFilter,
  );
  const bookings = (bookingsQuery.data?.items ?? []).filter((booking) => {
    if (jobFilter === 'ALL') return true;
    if (jobFilter === 'ACTIVE')
      return ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(
        booking.status,
      );
    return booking.status === jobFilter;
  });

  /** Ask first (works in a browser too), then refund through the payment provider. */
  const confirmRefund = async (kind: 'order' | 'booking', id: string, what: string, amount: number) => {
    if (refundGuard.current) return;
    refundGuard.current = true;
    try {
      const ok = await confirmAction(
        `Refund ${formatRupees(amount)}?`,
        `${what}. The customer gets the money back on their original payment method. This can't be undone.`,
        'Refund',
      );
      if (!ok) return;
      await (kind === 'order' ? refundOrder : refundBooking).mutateAsync(id);
      notice('Refund started', `${formatRupees(amount)} is on its way back to the customer.`);
    } catch (e: any) {
      notice('Refund failed', e?.message || 'Check your connection and try again.');
    } finally {
      refundGuard.current = false;
    }
  };

  /** Admin decisions on a job: each one asked first, with what it means. */
  const JOB_STEP: Record<string, { title: string; ask: string; button: string }> = {
    COMPLETED: { title: 'Mark the job complete?', ask: 'The issue is closed and the provider can be paid.', button: 'Complete' },
    CANCELLED: { title: 'Cancel this job?', ask: 'The job stops. Refund the payment separately if one was made.', button: 'Cancel job' },
    DISPUTED: { title: 'Flag a dispute?', ask: 'Payment to the provider is held until you resolve it.', button: 'Flag dispute' },
  };
  const changeJob = async (id: string, status: string) => {
    const step = JOB_STEP[status];
    if (step && !(await confirmAction(step.title, step.ask, step.button))) return;
    try {
      await updateBooking.mutateAsync({ id, status });
    } catch (e: any) {
      notice('Could not update the job', e?.message || 'Check your connection and try again.');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <View style={styles.headerPad}>
        <PageHeader title="Operations" subtitle="Orders, jobs, refunds and disputes" />
      </View>
      <RefSearch />

      <View style={styles.segment}>
        <Chip
          label="Orders"
          selected={segment === 'orders'}
          onPress={() => setSegment('orders')}
        />
        <Chip
          label="Jobs"
          selected={segment === 'jobs'}
          onPress={() => setSegment('jobs')}
        />
      </View>

      {segment === 'orders' ? (
        <FlatList
          refreshControl={ordersRefresh}
          data={ordersQuery.isLoading ? [] : orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.filters}>
                {ORDER_FILTERS.map((item) => (
                  <Chip
                    key={item}
                    label={
                      item === 'ALL'
                        ? 'All'
                        : item === 'PENDING'
                          ? 'Unpaid'
                          : statusLabel(item)
                    }
                    selected={orderFilter === item}
                    onPress={() => setOrderFilter(item)}
                  />
                ))}
              </View>
              {ordersQuery.isLoading
                ? [0, 1, 2].map((i) => (
                    <View key={i} style={styles.skeleton}>
                      <Skeleton width="60%" height={16} />
                      <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
                    </View>
                  ))
                : null}
            </View>
          }
          ListEmptyComponent={
            ordersQuery.isLoading ? undefined : ordersQuery.isError ? (
              <ErrorState message="Check your connection and try again." onRetry={() => void ordersQuery.refetch()} />
            ) : (
              <EmptyState
                icon={<Package size={26} color={palette.textMuted} strokeWidth={1.7} />}
                title="No orders here"
                message="Parts orders across all dealers will appear here."
              />
            )
          }
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              refunding={refundOrder.isPending}
              onRefund={() =>
                void confirmRefund(
                  'order',
                  item.id,
                  `Parts order ${refOf(item)}, ${item.sparePart?.name ?? 'parts'}`,
                  Number(item.totalAmount),
                )
              }
            />
          )}
        />
      ) : (
        <FlatList
          refreshControl={bookingsRefresh}
          data={bookingsQuery.isLoading ? [] : bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.filters}>
                {JOB_FILTERS.map((item) => (
                  <Chip
                    key={item}
                    label={item === 'ALL' ? 'All' : statusLabel(item)}
                    selected={jobFilter === item}
                    onPress={() => setJobFilter(item)}
                  />
                ))}
              </View>
              {bookingsQuery.isLoading
                ? [0, 1, 2].map((i) => (
                    <View key={i} style={styles.skeleton}>
                      <Skeleton width="60%" height={16} />
                      <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
                    </View>
                  ))
                : null}
            </View>
          }
          ListEmptyComponent={
            bookingsQuery.isLoading ? undefined : bookingsQuery.isError ? (
              <ErrorState message="Check your connection and try again." onRetry={() => void bookingsQuery.refetch()} />
            ) : (
              <EmptyState
                icon={<Wrench size={26} color={palette.textMuted} strokeWidth={1.7} />}
                title="No jobs here"
                message="Bookings from every provider will appear here."
              />
            )
          }
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              refunding={refundBooking.isPending}
              updating={updateBooking.isPending}
              onRefund={() =>
                void confirmRefund(
                  'booking',
                  item.id,
                  `Job ${refOf(item)}, ${item.request?.title ?? 'service job'}`,
                  Number(item.payment?.amount ?? item.totalCost),
                )
              }
              onStatus={(status) => void changeJob(item.id, status)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function OrderRow({
  order,
  refunding,
  onRefund,
}: {
  order: AdminOrder;
  refunding: boolean;
  onRefund: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const customer = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim()
    : 'Customer';

  return (
    <View style={styles.rowWrap}>
      <PressableScale
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${refOf(order)}`}
        scaleTo={0.99}
        style={styles.row}
      >
        <View style={styles.rowText}>
          <Text style={styles.title} numberOfLines={1}>
            {order.sparePart?.name ?? 'Parts order'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {order.provider?.businessName ?? 'Dealer'}, to {customer}
          </Text>
          <Text style={styles.meta} selectable>
            {refOf(order)}, {formatDate(order.createdAt)}, quantity {order.quantity}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.amount}>
            {formatRupees(order.totalAmount)}
          </Text>
          <StatusPill
            label={order.status === 'PENDING' ? 'Unpaid' : statusLabel(order.status)}
            tone={orderTone(order.status)}
          />
        </View>
      </PressableScale>

      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.meta}>
            Delivery: {statusLabel(order.fulfillmentStatus)}
            {order.trackingNumber ? `, tracking ${order.trackingNumber}` : ''}
          </Text>
          {order.paidAt ? (
            <Text style={styles.meta}>Paid {formatDate(order.paidAt)}</Text>
          ) : null}
          {order.status === 'PAID' ? (
            <Button
              title="Refund order"
              variant="destructive"
              loading={refunding}
              onPress={onRefund}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function BookingRow({
  booking,
  refunding,
  updating,
  onRefund,
  onStatus,
}: {
  booking: AdminBooking;
  refunding: boolean;
  updating: boolean;
  onRefund: () => void;
  onStatus: (status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const customer = booking.customer
    ? `${booking.customer.firstName} ${booking.customer.lastName ?? ''}`.trim()
    : 'Customer';
  const canRefund = ['AUTHORIZED', 'CAPTURED', 'RELEASED'].includes(
    booking.payment?.status ?? '',
  );
  const canFlag =
    ['IN_PROGRESS', 'COMPLETED'].includes(booking.status) &&
    booking.status !== 'DISPUTED';

  return (
    <View style={styles.rowWrap}>
      <PressableScale
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={`Job ${booking.request?.title ?? ''}`}
        scaleTo={0.99}
        style={styles.row}
      >
        <View style={styles.rowText}>
          <Text style={styles.title} numberOfLines={1}>
            {booking.request?.title ?? 'Service job'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {booking.provider?.businessName ?? 'Provider'}, for {customer}
          </Text>
          <Text style={styles.meta} selectable>
            {refOf(booking)}, {titleize(booking.request?.category ?? 'SERVICE')}, {formatDate(booking.createdAt)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.amount}>
            {formatRupees(booking.totalCost)}
          </Text>
          <StatusPill label={statusLabel(booking.status)} tone={bookingStatusTone(booking.status)} />
        </View>
      </PressableScale>

      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.meta}>
            Payment: {booking.payment ? statusLabel(booking.payment.status) : 'none'}
            {booking.payment ? `, ${formatRupees(booking.payment.amount)}` : ''}
          </Text>
          {booking.completionNotes ? (
            <Text style={styles.meta}>Notes: {booking.completionNotes}</Text>
          ) : null}
          <View style={styles.actions}>
            {booking.status === 'DISPUTED' ? (
              <>
                <Button
                  title="Mark complete"
                  loading={updating}
                  onPress={() => onStatus('COMPLETED')}
                />
                <Button
                  title="Cancel job"
                  variant="destructive"
                  onPress={() => onStatus('CANCELLED')}
                />
              </>
            ) : null}
            {canFlag ? (
              <Button
                title="Flag dispute"
                variant="secondary"
                onPress={() => onStatus('DISPUTED')}
              />
            ) : null}
            {canRefund ? (
              <Button
                title="Refund payment"
                variant="destructive"
                loading={refunding}
                onPress={onRefund}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  skeleton: { paddingVertical: spacing.md },
  rowWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  title: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  amount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  detail: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
