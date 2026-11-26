import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Wrench } from 'lucide-react-native';
import { useBookings, useUpdateBookingStatus, type Booking } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { haptics } from '@/lib/haptics';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  PressableScale,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { palette, radii, spacing, typography } from '@/theme';
import { bookingStatusTone, formatRupees, titleize } from '@/utils/format';
import { nextJobStep } from '@/utils/jobSteps';
import { useRefreshControl } from '@/hooks/useRefreshControl';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const DONE_LABEL: Record<string, string> = { COMPLETED: 'Completed', CANCELLED: 'Cancelled', DISPUTED: 'Disputed' };

const customerName = (b: Booking) =>
  b.customer ? `${b.customer.firstName} ${b.customer.lastName ?? ''}`.trim() : 'Customer';
const carName = (b: Booking) => {
  const v = b.quotation?.request?.vehicle;
  return v ? [v.make, v.model, v.year].filter(Boolean).join(' ') : null;
};

/** Same day on the phone's calendar. */
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today", "Yesterday" or "22 Nov". */
function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "Today 4:00 pm" / "Fri, 28 Nov, 10:00 am" for when the job is booked. */
function whenLabel(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, new Date())) return `Today ${time}`;
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

function ToDoCard({ job, onOpen }: { job: Booking; onOpen: () => void }) {
  const update = useUpdateBookingStatus();
  const step = nextJobStep(job);
  const request = job.quotation?.request;
  const car = carName(job);
  const when = whenLabel(job.scheduledAt);
  const act = async () => {
    // Completing needs a confirmation and notes: that lives on the job screen.
    if (!step?.next) return onOpen();
    try {
      await update.mutateAsync({ id: job.id, status: step.next });
      haptics.success();
    } catch {
      // The hook already shows what went wrong.
    }
  };
  return (
    <View style={styles.todo}>
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open job: ${request?.title ?? 'Job'}, ${step?.label ?? ''}`}
        scaleTo={0.99}
      >
        <View style={styles.todoTop}>
          <Text style={styles.todoTitle} numberOfLines={2}>
            {request?.title ?? 'Service job'}
          </Text>
          <Text style={styles.amount}>{formatRupees(job.quotation?.totalCost ?? 0)}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[customerName(job), car].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {request?.category === 'TOWING' && request.dropoffAddress
            ? `${request.address} to ${request.dropoffAddress}`
            : request?.address ?? 'At the workshop'}
        </Text>
        <View style={styles.todoPills}>
          {step ? <StatusPill label={step.label} tone={job.status === 'IN_PROGRESS' ? 'warning' : 'info'} /> : null}
          {when ? <Text style={styles.when}>{when}</Text> : null}
        </View>
      </PressableScale>
      {step ? <Button title={step.title} loading={update.isPending} onPress={() => void act()} style={styles.todoButton} /> : null}
    </View>
  );
}

function JobRow({ job, onPress }: { job: Booking; onPress: () => void }) {
  const request = job.quotation?.request;
  const status = DONE_LABEL[job.status] ?? titleize(job.status);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${request?.title ?? 'Job'}, ${formatRupees(job.quotation?.totalCost ?? 0)}, ${status}`}
      scaleTo={0.99}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {request?.title ?? 'Service job'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[customerName(job), carName(job)].filter(Boolean).join(', ')}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>{formatRupees(job.quotation?.totalCost ?? 0)}</Text>
        <StatusPill label={status} tone={bookingStatusTone(job.status)} />
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

type ListItem = { kind: 'head'; key: string; label: string } | { kind: 'job'; key: string; job: Booking; first: boolean };

export default function MechanicJobsScreen() {
  const router = useRouter();
  const { providerProfile } = useAuth();
  const providerType = providerProfile?.providerType ?? '';
  const kind = providerType === 'TOWING' ? 'tows' : providerType === 'ROADSIDE' ? 'calls' : 'jobs';
  const [filter, setFilter] = useState<Filter>('ALL');
  // To do: every job still moving, however old. History: the latest 50.
  const activeQuery = useBookings(undefined, { active: true, limit: 50 });
  const historyQuery = useBookings(undefined, { limit: 50 });
  const refreshControl = useRefreshControl(() => Promise.all([activeQuery.refetch(), historyQuery.refetch()]));

  const todo = [...(activeQuery.data?.items ?? [])].sort(
    (a, b) => new Date(a.scheduledAt ?? a.createdAt).getTime() - new Date(b.scheduledAt ?? b.createdAt).getTime(),
  );
  const todayCount = todo.filter((j) => j.scheduledAt && sameDay(new Date(j.scheduledAt), new Date())).length;
  const done = (historyQuery.data?.items ?? []).filter(
    (j) => !['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(j.status),
  );
  const shown = filter === 'ALL' ? done : done.filter((j) => j.status === filter);

  const items: ListItem[] = [];
  let lastHead = '';
  for (const job of shown) {
    const head = dayHeading(job.completedAt ?? job.scheduledAt ?? job.createdAt);
    if (head !== lastHead) {
      items.push({ kind: 'head', key: `h-${head}-${job.id}`, label: head });
      lastHead = head;
    }
    items.push({ kind: 'job', key: job.id, job, first: items[items.length - 1]?.kind === 'head' });
  }

  const loading = activeQuery.isLoading || historyQuery.isLoading;
  const subtitle = loading
    ? `Your ${kind}`
    : todo.length === 0
      ? `Nothing in progress`
      : `${todo.length} in progress${todayCount ? `, ${todayCount} today` : ''}`;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        refreshControl={refreshControl}
        data={loading ? [] : items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <PageHeader title="Jobs" subtitle={subtitle} />
            {loading
              ? [0, 1].map((i) => <Skeleton key={i} width="100%" height={150} style={{ marginBottom: spacing.md }} />)
              : null}
            {todo.length > 0 ? (
              <>
                <Text style={styles.section}>To do ({todo.length})</Text>
                {todo.map((job) => (
                  <ToDoCard key={job.id} job={job} onOpen={() => router.push(`/job/${job.id}`)} />
                ))}
              </>
            ) : null}
            {done.length > 0 ? (
              <>
                <Text style={styles.section}>Finished</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                  {FILTERS.map((f) => (
                    <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : activeQuery.isError || historyQuery.isError ? (
            <ErrorState message="Check your connection and try again." onRetry={() => void historyQuery.refetch()} />
          ) : todo.length === 0 ? (
            <EmptyState
              icon={<Wrench size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={`No ${kind} yet`}
              message="When a customer accepts your quote, the job appears here."
              action={<Button title="See requests near you" variant="secondary" onPress={() => router.push('/opportunities')} />}
            />
          ) : filter !== 'ALL' ? (
            <Text style={styles.emptyLine}>Nothing here yet.</Text>
          ) : undefined
        }
        ListFooterComponent={
          (historyQuery.data?.items.length ?? 0) >= 50 ? <Text style={styles.footnote}>Showing your latest 50 jobs.</Text> : undefined
        }
        renderItem={({ item }) =>
          item.kind === 'head' ? (
            <Text style={styles.dayHead}>{item.label}</Text>
          ) : (
            <View style={item.first ? undefined : styles.divider}>
              <JobRow job={item.job} onPress={() => router.push(`/job/${item.job.id}`)} />
            </View>
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
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
  todoPills: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  todoButton: { marginTop: spacing.md },
  when: { ...typography.captionMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  amount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  filters: { gap: spacing.sm, paddingBottom: spacing.sm },
  dayHead: { ...typography.captionMedium, color: palette.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  emptyLine: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },
  footnote: { ...typography.caption, color: palette.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
