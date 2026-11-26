import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Car } from 'lucide-react-native';
import { EmptyState, ErrorState, PageHeader, ScreenContainer, Skeleton } from '@/components/ui';
import { useDriverJobs } from '@/hooks/useDriverGo';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { palette, spacing, typography } from '@/theme';
import { TripRequestCard, TripRow, TripToDoCard } from './TripCards';

const ACTIVE = ['CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];

/** "Today", "Yesterday" or "22 Nov" on the phone's calendar. */
function dayHeading(iso: string) {
  const d = new Date(iso);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const today = new Date();
  if (key(d) === key(today)) return 'Today';
  if (key(d) === key(new Date(today.getTime() - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function DriverJobsScreen() {
  const router = useRouter();
  const jobsQuery = useDriverJobs();
  const refreshControl = useRefreshControl(jobsQuery.refetch);
  const jobs = jobsQuery.data?.items ?? [];
  const refetchJobs = jobsQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchJobs();
    }, [refetchJobs]),
  );

  const requested = jobs.filter((job) => job.status === 'REQUESTED');
  const active = jobs.filter((job) => ACTIVE.includes(job.status));
  const finished = jobs
    .filter((job) => ['COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'].includes(job.status))
    .sort((a, b) => new Date(b.completedAt ?? b.startAt).getTime() - new Date(a.completedAt ?? a.startAt).getTime());
  const open = (id: string) => router.push(`/driver-booking/${id}`);

  const subtitle = jobsQuery.isLoading
    ? 'Your trips'
    : [
        requested.length ? `${requested.length} new request${requested.length === 1 ? '' : 's'}` : null,
        active.length ? `${active.length} upcoming` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'Nothing waiting';

  // Show a date heading above the first trip of each day.
  const pastRows = finished.map((job, i) => {
    const head = dayHeading(job.completedAt ?? job.startAt);
    const prev = i > 0 ? dayHeading(finished[i - 1].completedAt ?? finished[i - 1].startAt) : null;
    return { job, head: head !== prev ? head : null };
  });

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        <PageHeader title="Trips" subtitle={subtitle} />
        {jobsQuery.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} width="100%" height={150} style={{ marginBottom: spacing.md }} />)
        ) : jobsQuery.isError ? (
          <ErrorState message="Check your connection and try again." onRetry={() => void jobsQuery.refetch()} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Car size={26} color={palette.textMuted} strokeWidth={1.7} />}
            title="No trips yet"
            message="Stay online during your available hours and new trip requests will appear here."
          />
        ) : (
          <>
            {requested.length > 0 ? (
              <>
                <Text style={styles.section}>New requests ({requested.length})</Text>
                {requested.map((job) => (
                  <TripRequestCard key={job.id} job={job} onOpen={() => open(job.id)} />
                ))}
              </>
            ) : null}
            {active.length > 0 ? (
              <>
                <Text style={styles.section}>Upcoming ({active.length})</Text>
                {active.map((job) => (
                  <TripToDoCard key={job.id} job={job} onOpen={() => open(job.id)} />
                ))}
              </>
            ) : null}
            {finished.length > 0 ? (
              <>
                <Text style={styles.section}>Past trips</Text>
                {pastRows.map(({ job, head }, i) => (
                  <View key={job.id}>
                    {head ? <Text style={styles.dayHead}>{head}</Text> : null}
                    <View style={!head && i > 0 ? styles.divider : undefined}>
                      <TripRow job={job} onPress={() => open(job.id)} />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  section: { ...typography.section, color: palette.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  dayHead: { ...typography.captionMedium, color: palette.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
});
