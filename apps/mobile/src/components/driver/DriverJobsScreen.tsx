import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AppHeader,
  EmptyState,
  ScreenContainer,
  SectionHead,
  Skeleton,
} from '@/components/ui';
import { useDriverJobs } from '@/hooks/useDriverGo';
import { DriverJobCard } from './DriverJobCard';
import { palette, spacing, typography } from '@/theme';

const ACTIVE = ['CONFIRMED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];

export function DriverJobsScreen() {
  const router = useRouter();
  const jobsQuery = useDriverJobs();
  const jobs = jobsQuery.data?.items ?? [];
  const refetchJobs = jobsQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      void refetchJobs();
    }, [refetchJobs]),
  );

  const requested = jobs.filter((job) => job.status === 'REQUESTED');
  const active = jobs.filter((job) => ACTIVE.includes(job.status));
  const finished = jobs.filter((job) =>
    ['COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'].includes(job.status),
  );

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader title="Jobs" subtitle="Driver Go requests and trips" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {jobsQuery.isLoading ? (
          <View>
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={150}
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </View>
        ) : jobsQuery.isError ? (
          <EmptyState
            title="Jobs unavailable"
            message="Could not load your jobs. Check your connection."
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            message="Go online from the dashboard to receive Driver Go requests."
          />
        ) : (
          <>
            {requested.length > 0 ? (
              <>
                <SectionHead index="01" title="New requests" />
                {requested.map((job) => (
                  <DriverJobCard
                    key={job.id}
                    job={job}
                    onPress={() => router.push(`/driver-booking/${job.id}`)}
                  />
                ))}
              </>
            ) : null}

            {active.length > 0 ? (
              <>
                <SectionHead
                  index={requested.length > 0 ? '02' : '01'}
                  title="Active"
                />
                {active.map((job) => (
                  <DriverJobCard
                    key={job.id}
                    job={job}
                    onPress={() => router.push(`/driver-booking/${job.id}`)}
                  />
                ))}
              </>
            ) : null}

            {finished.length > 0 ? (
              <>
                <SectionHead
                  index={
                    requested.length > 0 && active.length > 0
                      ? '03'
                      : requested.length > 0 || active.length > 0
                        ? '02'
                        : '01'
                  }
                  title="History"
                />
                {finished.map((job) => (
                  <DriverJobCard
                    key={job.id}
                    job={job}
                    onPress={() => router.push(`/driver-booking/${job.id}`)}
                  />
                ))}
              </>
            ) : null}

            {requested.length === 0 && active.length === 0 ? (
              <Text style={styles.quiet}>
                No active jobs. New requests will appear here.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  quiet: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
