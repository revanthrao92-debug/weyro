import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Package, Wrench } from 'lucide-react-native';
import { useAdminBookings, useAdminOrders, type AdminBooking, type AdminOrder } from '@/hooks/useAdmin';
import { Chip, EmptyState, ErrorState, PageHeader, PressableScale, ScreenContainer, Skeleton, StatusPill } from '@/components/ui';
import { RefSearch } from '@/components/admin/RefSearch';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { bookingStatusTone, formatDate, formatRupees, refOf, titleize } from '@/utils/format';
import { palette, spacing, typography, type StatusTone } from '@/theme';

const ORDER_FILTERS = ['ALL', 'PAID', 'PENDING', 'REFUNDED'] as const;
const JOB_FILTERS = ['ALL', 'ACTIVE', 'DISPUTED', 'COMPLETED', 'CANCELLED'] as const;
type Segment = 'orders' | 'jobs';

function orderTone(status: string): StatusTone {
  if (status === 'PAID') return 'success';
  if (status === 'REFUNDED' || status === 'CANCELLED' || status === 'FAILED') return 'danger';
  return 'warning';
}

const ORDER_LABEL: Record<string, string> = { ALL: 'All', PAID: 'Paid', PENDING: 'Not paid yet', REFUNDED: 'Refunded' };
const JOB_LABEL: Record<string, string> = {
  ALL: 'All',
  ACTIVE: 'In progress',
  DISPUTED: 'Disputed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PROVIDER_EN_ROUTE: 'On the way',
  IN_PROGRESS: 'In progress',
  CONFIRMED: 'Confirmed',
};

/**
 * Admin Operations: every parts order and job, newest first. Tap one to open its full record
 * (timeline, live tracking, money, people, refund and dispute actions).
 */
export default function OperationsScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('orders');
  const [orderFilter, setOrderFilter] = useState<(typeof ORDER_FILTERS)[number]>('ALL');
  const [jobFilter, setJobFilter] = useState<(typeof JOB_FILTERS)[number]>('ALL');
  const ordersQuery = useAdminOrders();
  const bookingsQuery = useAdminBookings();
  const ordersRefresh = useRefreshControl(ordersQuery.refetch);
  const bookingsRefresh = useRefreshControl(bookingsQuery.refetch);
  const open = (ref?: string) => ref && router.push(`/admin-record/${ref}`);

  const orders = (ordersQuery.data?.items ?? []).filter((o) => orderFilter === 'ALL' || o.status === orderFilter);
  const bookings = (bookingsQuery.data?.items ?? []).filter((b) =>
    jobFilter === 'ALL'
      ? true
      : jobFilter === 'ACTIVE'
        ? ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(b.status)
        : b.status === jobFilter,
  );
  const loadingRows = [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={64} style={{ marginBottom: spacing.sm }} />);

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <View style={styles.headerPad}>
        <PageHeader title="Operations" subtitle="Orders, jobs, refunds and disputes. Tap one for everything about it." />
      </View>
      <RefSearch />

      <View style={styles.segment}>
        <Chip label="Orders" selected={segment === 'orders'} onPress={() => setSegment('orders')} />
        <Chip label="Jobs" selected={segment === 'jobs'} onPress={() => setSegment('jobs')} />
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
                {ORDER_FILTERS.map((f) => (
                  <Chip key={f} label={ORDER_LABEL[f]} selected={orderFilter === f} onPress={() => setOrderFilter(f)} />
                ))}
              </View>
              {ordersQuery.isLoading ? loadingRows : null}
            </View>
          }
          ListEmptyComponent={
            ordersQuery.isLoading ? undefined : ordersQuery.isError ? (
              <ErrorState message="Check your connection and try again." onRetry={() => void ordersQuery.refetch()} />
            ) : (
              <EmptyState
                icon={<Package size={26} color={palette.textMuted} strokeWidth={1.7} />}
                title="No orders here"
                message="Parts orders across all dealers appear here."
              />
            )
          }
          renderItem={({ item }) => <OrderRow order={item} onOpen={() => open(item.ref)} />}
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
                {JOB_FILTERS.map((f) => (
                  <Chip key={f} label={JOB_LABEL[f]} selected={jobFilter === f} onPress={() => setJobFilter(f)} />
                ))}
              </View>
              {bookingsQuery.isLoading ? loadingRows : null}
            </View>
          }
          ListEmptyComponent={
            bookingsQuery.isLoading ? undefined : bookingsQuery.isError ? (
              <ErrorState message="Check your connection and try again." onRetry={() => void bookingsQuery.refetch()} />
            ) : (
              <EmptyState
                icon={<Wrench size={26} color={palette.textMuted} strokeWidth={1.7} />}
                title="No jobs here"
                message="Jobs from every provider appear here."
              />
            )
          }
          renderItem={({ item }) => <BookingRow booking={item} onOpen={() => open(item.ref)} />}
        />
      )}
    </ScreenContainer>
  );
}

const customerName = (c?: { firstName: string; lastName?: string | null } | null) =>
  c ? `${c.firstName} ${c.lastName ?? ''}`.trim() : 'Customer';

function OrderRow({ order, onOpen }: { order: AdminOrder; onOpen: () => void }) {
  return (
    <PressableScale onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Order ${refOf(order)}`} scaleTo={0.99} style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {order.sparePart?.name ?? 'Parts order'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {order.provider?.businessName ?? 'Dealer'}, to {customerName(order.customer)}
        </Text>
        <Text style={styles.meta}>
          {refOf(order)}, {formatDate(order.createdAt)}, quantity {order.quantity}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>{formatRupees(order.totalAmount)}</Text>
        <StatusPill label={ORDER_LABEL[order.status] ?? titleize(order.status)} tone={orderTone(order.status)} />
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

function BookingRow({ booking, onOpen }: { booking: AdminBooking; onOpen: () => void }) {
  return (
    <PressableScale onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Job ${refOf(booking)}`} scaleTo={0.99} style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {booking.request?.title ?? 'Service job'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {booking.provider?.businessName ?? 'Provider'}, for {customerName(booking.customer)}
        </Text>
        <Text style={styles.meta}>
          {refOf(booking)}, {titleize(booking.request?.category ?? 'SERVICE')}, {formatDate(booking.createdAt)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>{formatRupees(booking.totalCost)}</Text>
        <StatusPill label={JOB_LABEL[booking.status] ?? titleize(booking.status)} tone={bookingStatusTone(booking.status)} />
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  segment: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowText: { flex: 1, gap: 2 },
  title: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  amount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
});
