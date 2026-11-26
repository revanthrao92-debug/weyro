import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Package } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  useDealerOrders,
  useMyOrders,
  useUpdateFulfillment,
  type FulfillmentStatus,
  type SparePartOrder,
} from '@/hooks/useParts';
import { useProviderDashboard } from '@/hooks/useProviderDashboard';
import { useBookings, type Booking } from '@/hooks/useBookings';
import { JobRow, ToDoCard as JobToDoCard } from '@/components/provider/JobCards';
import { haptics } from '@/lib/haptics';
import {
  ScreenContainer,
  BackButton,
  Chip,
  PressableScale,
  StatusPill,
  EmptyState,
  Skeleton,
  Button,
  ErrorState,
  PageHeader,
} from '@/components/ui';
import {
  palette,
  radii,
  spacing,
  typography,
  displayFamily,
  type StatusTone,
} from '@/theme';
import { formatDate, titleize, formatRupees, formatRupees as money } from '@/utils/format';
import { useRefreshControl } from '@/hooks/useRefreshControl';

function orderTone(status: string): StatusTone {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'PAID':
      return 'success';
    case 'CANCELLED':
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function OrderRow({
  item,
  dealer,
  onPress,
}: {
  item: SparePartOrder;
  dealer: boolean;
  onPress?: () => void;
}) {
  const part = item.sparePart?.name ?? 'Spare part';
  const who = item.customer
    ? `${item.customer.firstName} ${item.customer.lastName ?? ''}`.trim()
    : 'Customer';
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowKicker}>
          {formatDate(item.createdAt)} · qty {item.quantity}
        </Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {part}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {dealer ? who : item.sparePart?.partNumber ?? 'Order'}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>
          {formatRupees(item.totalAmount)}
        </Text>
        {item.status === 'PAID' && item.fulfillmentStatus ? (
          <StatusPill
            label={fulfillmentLabel(item.fulfillmentStatus)}
            tone={fulfillmentTone(item.fulfillmentStatus)}
          />
        ) : item.status === 'PENDING' ? (
          <StatusPill label="Unpaid" tone="warning" />
        ) : (
          <StatusPill label={titleize(item.status)} tone={orderTone(item.status)} />
        )}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${part}, ${titleize(item.status)}`}
      scaleTo={0.99}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

function fulfillmentLabel(status: string) {
  return status === 'PENDING' ? 'To pack' : titleize(status);
}

function fulfillmentTone(status?: string): StatusTone {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'SHIPPED':
      return 'info';
    case 'READY':
      return 'info';
    case 'PROCESSING':
      return 'warning';
    default:
      return 'neutral';
  }
}

function OrdersHeader({
  eyebrow,
  title,
  summary,
}: {
  eyebrow: string;
  title: string;
  summary: string;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

export function CustomerOrders({ pushed = false }: { pushed?: boolean } = {}) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyOrders();
  const refreshControl = useRefreshControl(refetch);
  const orders = data ?? [];
  const open = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <FlatList
        refreshControl={refreshControl}
        data={isLoading ? [] : orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <View>
            {pushed ? (
              <View style={styles.backRow}>
                <BackButton />
              </View>
            ) : null}
            <OrdersHeader
              eyebrow="Purchases"
              title="Part orders"
              summary={
                orders.length === 0
                  ? 'No orders yet'
                  : `${open} awaiting payment · ${orders.length} total`
              }
            />
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.rowText}>
                      <Skeleton width={110} height={10} />
                      <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
                    </View>
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : isError ? (
            <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              icon={<Package size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title="No part orders yet"
              message="Parts you order from the shop appear here with their payment state."
              action={
                <Button title="Browse parts" onPress={() => router.push('/shop')} />
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <View style={index > 0 ? styles.divider : undefined}>
            <OrderRow
              item={item}
              dealer={false}
              onPress={() => router.push(`/order/${item.id}`)}
            />
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const DEALER_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'UNPAID', label: 'Unpaid' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const;
type DealerFilter = (typeof DEALER_FILTERS)[number]['key'];

/** What the dealer does next for a paid order, by its current step. */
const NEXT_STEP: Record<string, { label: string; title: string; next?: FulfillmentStatus }> = {
  PENDING: { label: 'To pack', title: 'Start packing', next: 'PROCESSING' },
  PROCESSING: { label: 'Packing', title: 'Mark ready to ship', next: 'READY' },
  // Shipping needs a carrier and tracking number, entered on the order screen.
  READY: { label: 'Ready to ship', title: 'Add tracking and ship' },
  SHIPPED: { label: 'On the way', title: 'Mark delivered', next: 'DELIVERED' },
};

const customerName = (o: SparePartOrder) =>
  o.customer ? `${o.customer.firstName} ${o.customer.lastName ?? ''}`.trim() : 'Customer';

/** "Today", "Yesterday", or "22 Nov" on the phone's calendar. */
function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "today", "yesterday" or "16 Nov", to follow the word "paid". */
const paidWhen = (iso: string) => {
  const h = dayHeading(iso);
  return h === 'Today' || h === 'Yesterday' ? h.toLowerCase() : h;
};

function ToDoCard({ order, onOpen }: { order: SparePartOrder; onOpen: () => void }) {
  const update = useUpdateFulfillment();
  const step = NEXT_STEP[order.fulfillmentStatus ?? 'PENDING'] ?? NEXT_STEP.PENDING;
  const part = order.sparePart?.name ?? 'Spare part';
  const act = async () => {
    if (!step.next) return onOpen();
    try {
      await update.mutateAsync({ orderId: order.id, status: step.next });
      haptics.success();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update the order.');
    }
  };
  return (
    <View style={styles.todo}>
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open order: ${part}, ${step.label}`}
        scaleTo={0.99}
      >
        <View style={styles.todoTop}>
          <Text style={styles.todoTitle} numberOfLines={2}>
            {part}
            {order.quantity > 1 ? ` x${order.quantity}` : ''}
          </Text>
          <Text style={styles.todoPrice}>{money(order.totalAmount)}</Text>
        </View>
        <Text style={styles.todoMeta}>
          {customerName(order)}, paid {paidWhen(order.paidAt ?? order.createdAt)}
        </Text>
        <View style={styles.todoPill}>
          <StatusPill label={step.label} tone={order.fulfillmentStatus === 'SHIPPED' ? 'info' : 'warning'} />
        </View>
      </PressableScale>
      <Button title={step.title} loading={update.isPending} onPress={() => void act()} style={styles.todoButton} />
    </View>
  );
}

type ListItem =
  | { kind: 'head'; key: string; label: string }
  | { kind: 'order'; key: string; order: SparePartOrder; first: boolean }
  | { kind: 'job'; key: string; job: Booking; first: boolean };

function DealerOrders() {
  const router = useRouter();
  const [filter, setFilter] = useState<DealerFilter>('ALL');
  const { data, isLoading, isError, refetch } = useDealerOrders({ limit: 50 });
  const todoQuery = useDealerOrders({ needsAction: true, limit: 50 });
  const dashboard = useProviderDashboard();
  // Accepted quotes on part requests become jobs (bookings); they live here too.
  const activeJobsQuery = useBookings(undefined, { active: true, limit: 50 });
  const jobHistoryQuery = useBookings(undefined, { limit: 50 });
  const refreshControl = useRefreshControl(() =>
    Promise.all([refetch(), todoQuery.refetch(), activeJobsQuery.refetch(), jobHistoryQuery.refetch()]),
  );
  const orders = data?.items ?? [];
  const todo = todoQuery.data?.items ?? [];
  const todoIds = new Set(todo.map((o) => o.id));
  const todoJobs = activeJobsQuery.data?.items ?? [];
  const doneJobs = (jobHistoryQuery.data?.items ?? []).filter(
    (j) => !['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(j.status),
  );
  const todoCount = todo.length + todoJobs.length;

  // The date list holds everything except the to-do cards above it; unpaid orders get their own group.
  const finished = orders.filter((o) => !todoIds.has(o.id) && o.status !== 'PENDING');
  const unpaid = orders.filter((o) => o.status === 'PENDING');
  const shown =
    filter === 'UNPAID'
      ? unpaid
      : filter === 'DELIVERED'
        ? finished.filter((o) => o.fulfillmentStatus === 'DELIVERED')
        : filter === 'CANCELLED'
          ? finished.filter((o) => ['CANCELLED', 'FAILED', 'REFUNDED'].includes(o.status) || o.fulfillmentStatus === 'CANCELLED')
          : finished;

  // Finished request jobs join the dated list (not under Unpaid: they are paid through the booking).
  const shownJobs =
    filter === 'UNPAID'
      ? []
      : filter === 'DELIVERED'
        ? doneJobs.filter((j) => j.status === 'COMPLETED')
        : filter === 'CANCELLED'
          ? doneJobs.filter((j) => j.status === 'CANCELLED')
          : doneJobs;
  const dated = [
    ...shown.map((order) => ({ at: order.createdAt, order, job: undefined as Booking | undefined })),
    ...shownJobs.map((job) => ({ at: job.completedAt ?? job.createdAt, order: undefined as SparePartOrder | undefined, job })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const items: ListItem[] = [];
  let lastHead = '';
  dated.forEach(({ at, order, job }) => {
    const head = filter === 'UNPAID' ? 'Waiting for payment' : dayHeading(at);
    if (head !== lastHead) {
      items.push({ kind: 'head', key: `h-${head}-${order?.id ?? job?.id}`, label: head });
      lastHead = head;
    }
    // No divider under a heading, only between rows.
    const first = items[items.length - 1]?.kind === 'head';
    if (order) items.push({ kind: 'order', key: order.id, order, first });
    else if (job) items.push({ kind: 'job', key: `job-${job.id}`, job, first });
  });
  if (filter === 'ALL' && unpaid.length > 0) {
    items.push({ kind: 'head', key: 'h-unpaid', label: `Waiting for payment (${unpaid.length})` });
    unpaid.forEach((order, i) => items.push({ kind: 'order', key: order.id, order, first: i === 0 }));
  }

  const paidTotal = dashboard.data?.revenue.paidTotal;
  const subtitle =
    orders.length === 0 && todoJobs.length === 0 && doneJobs.length === 0 && !isLoading
      ? 'No orders yet'
      : [
          todoCount === 0 ? 'Nothing to do' : `${todoCount} to do`,
          paidTotal !== undefined ? `${money(Math.round(paidTotal))} paid in total` : null,
        ]
          .filter(Boolean)
          .join(', ');

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        refreshControl={refreshControl}
        data={isLoading ? [] : items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <View>
            <PageHeader title="Orders" subtitle={subtitle} />
            {todoCount > 0 ? (
              <>
                <Text style={styles.section}>To do ({todoCount})</Text>
                {todo.map((order) => (
                  <ToDoCard key={order.id} order={order} onOpen={() => router.push(`/order/${order.id}`)} />
                ))}
                {todoJobs.map((job) => (
                  <JobToDoCard key={job.id} job={job} onOpen={() => router.push(`/job/${job.id}`)} />
                ))}
              </>
            ) : null}
            {orders.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                {DEALER_FILTERS.map((item) => (
                  <Chip key={item.key} label={item.label} selected={filter === item.key} onPress={() => setFilter(item.key)} />
                ))}
              </ScrollView>
            ) : null}
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.rowText}>
                      <Skeleton width={110} height={12} />
                      <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
                    </View>
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : isError ? (
            <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              icon={<Package size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={orders.length === 0 ? 'No orders yet' : 'Nothing here'}
              message={orders.length === 0 ? 'Paid orders for your listings appear here.' : 'No orders match this filter.'}
            />
          )
        }
        ListFooterComponent={
          orders.length >= 50 ? <Text style={styles.footnote}>Showing your latest 50 orders.</Text> : undefined
        }
        renderItem={({ item }) =>
          item.kind === 'head' ? (
            <Text style={styles.dayHead}>{item.label}</Text>
          ) : (
            <View style={item.first ? undefined : styles.divider}>
              {item.kind === 'job' ? (
                <JobRow job={item.job} onPress={() => router.push(`/job/${item.job.id}`)} />
              ) : (
                <DealerRow order={item.order} onPress={() => router.push(`/order/${item.order.id}`)} />
              )}
            </View>
          )
        }
      />
    </ScreenContainer>
  );
}

function DealerRow({ order, onPress }: { order: SparePartOrder; onPress: () => void }) {
  const part = order.sparePart?.name ?? 'Spare part';
  const status =
    order.status === 'PENDING'
      ? 'Unpaid'
      : order.status === 'PAID'
        ? titleize(order.fulfillmentStatus ?? 'PENDING')
        : titleize(order.status);
  const tone: StatusTone =
    order.status === 'PENDING'
      ? 'warning'
      : order.status === 'PAID' && order.fulfillmentStatus === 'DELIVERED'
        ? 'success'
        : order.status === 'PAID'
          ? 'neutral'
          : 'danger';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${part}, ${money(order.totalAmount)}, ${status}`}
      scaleTo={0.99}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {part}
          {order.quantity > 1 ? ` x${order.quantity}` : ''}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {customerName(order)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{money(order.totalAmount)}</Text>
        <StatusPill label={status} tone={tone} />
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

export default function OrdersScreen() {
  const { role } = useAuth();
  return role === 'PROVIDER' || role === 'BOTH' ? <DealerOrders /> : <CustomerOrders />;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
  backRow: { marginBottom: spacing.sm },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  eyebrow: { ...typography.label, color: palette.textMuted },
  title: {
    fontFamily: displayFamily,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  summary: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowText: { flex: 1 },
  rowKicker: { fontSize: 12, color: palette.textMuted },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 3 },
  rowMeta: { ...typography.label, color: palette.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  section: { ...typography.section, color: palette.textPrimary, marginBottom: spacing.sm },
  todo: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  todoTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  todoTitle: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  todoPrice: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  todoMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  todoPill: { flexDirection: 'row', marginTop: spacing.sm },
  todoButton: { marginTop: spacing.md },
  dayHead: { ...typography.captionMedium, color: palette.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  rowSub: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  rowAmount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  footnote: { ...typography.caption, color: palette.textMuted, textAlign: 'center', marginTop: spacing.lg },
  rowPrice: {
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
