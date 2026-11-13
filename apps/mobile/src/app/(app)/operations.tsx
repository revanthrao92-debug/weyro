import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
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
  AppHeader,
  Button,
  Chip,
  EmptyState,
  PressableScale,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { formatDate, titleize } from '@/utils/format';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
  type StatusTone,
} from '@/theme';

const ORDER_FILTERS = ['ALL', 'PAID', 'PENDING', 'REFUNDED'] as const;
const JOB_FILTERS = ['ALL', 'ACTIVE', 'DISPUTED', 'COMPLETED', 'CANCELLED'] as const;
type Segment = 'orders' | 'jobs';

function orderTone(status: string): StatusTone {
  if (status === 'PAID') return 'success';
  if (status === 'REFUNDED') return 'danger';
  if (status === 'CANCELLED' || status === 'FAILED') return 'danger';
  return 'warning';
}

function jobTone(status: string): StatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'DISPUTED' || status === 'CANCELLED') return 'danger';
  if (status === 'IN_PROGRESS' || status === 'PROVIDER_EN_ROUTE') return 'info';
  return 'neutral';
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
  const refundOrder = useAdminRefundOrder();
  const refundBooking = useAdminRefundBooking();
  const updateBooking = useUpdateBookingStatus();

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

  const confirmRefund = (kind: 'order' | 'booking', id: string) =>
    Alert.alert(
      'Issue refund',
      'Refund the captured payment through the gateway?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: () => {
            const mutation = kind === 'order' ? refundOrder : refundBooking;
            mutation.mutateAsync(id).catch((e: any) =>
              Alert.alert('Refund failed', e?.message || 'Could not refund.'),
            );
          },
        },
      ],
    );

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader title="Operations" subtitle="Orders, jobs and disputes" />

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
            ordersQuery.isLoading ? undefined : (
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
              onRefund={() => confirmRefund('order', item.id)}
            />
          )}
        />
      ) : (
        <FlatList
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
            bookingsQuery.isLoading ? undefined : (
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
              onRefund={() => confirmRefund('booking', item.id)}
              onStatus={(status) => {
                updateBooking
                  .mutateAsync({ id: item.id, status })
                  .catch((e: any) =>
                    Alert.alert('Failed', e?.message || 'Could not update job.'),
                  );
              }}
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
        accessibilityLabel={`Order ${order.id.slice(0, 8)}`}
        scaleTo={0.99}
        style={styles.row}
      >
        <View style={styles.rowText}>
          <Text style={styles.title} numberOfLines={1}>
            {order.sparePart?.name ?? 'Parts order'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {order.provider?.businessName ?? 'Dealer'} · {customer}
          </Text>
          <Text style={styles.meta}>
            {formatDate(order.createdAt)} · qty {order.quantity}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.amount}>
            ₹{Number(order.totalAmount).toLocaleString('en-IN')}
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
            Fulfillment: {statusLabel(order.fulfillmentStatus)}
            {order.trackingNumber ? ` · ${order.trackingNumber}` : ''}
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
            {booking.provider?.businessName ?? 'Provider'} · {customer}
          </Text>
          <Text style={styles.meta}>
            {titleize(booking.request?.category ?? 'SERVICE')} ·{' '}
            {formatDate(booking.createdAt)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.amount}>
            ₹{Number(booking.totalCost).toLocaleString('en-IN')}
          </Text>
          <StatusPill label={statusLabel(booking.status)} tone={jobTone(booking.status)} />
        </View>
      </PressableScale>

      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.meta}>
            Payment: {booking.payment ? statusLabel(booking.payment.status) : 'none'}
            {booking.payment
              ? ` · ₹${Number(booking.payment.amount).toLocaleString('en-IN')}`
              : ''}
          </Text>
          {booking.completionNotes ? (
            <Text style={styles.meta}>Notes: {booking.completionNotes}</Text>
          ) : null}
          <View style={styles.actions}>
            {booking.status === 'DISPUTED' ? (
              <>
                <Button
                  title="Resolve completed"
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
  meta: { ...typography.label, color: palette.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  amount: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
