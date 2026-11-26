import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { JobRow, ToDoCard } from '@/components/provider/JobCards';
import { useBookings, type Booking } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  ScreenContainer,
  Skeleton,
} from '@/components/ui';
import { palette, radii, spacing, typography } from '@/theme';
import { useRefreshControl } from '@/hooks/useRefreshControl';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

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
  filters: { gap: spacing.sm, paddingBottom: spacing.sm },
  dayHead: { ...typography.captionMedium, color: palette.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  emptyLine: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },
  footnote: { ...typography.caption, color: palette.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
