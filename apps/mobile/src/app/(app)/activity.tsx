import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Activity } from 'lucide-react-native';
import { useAdminActivity, useAdminActivityStats } from '@/hooks/useAdmin';
import { Chip, EmptyState, ErrorState, PageHeader, PressableScale, ScreenContainer, Skeleton } from '@/components/ui';
import { ActivityChart } from '@/components/admin/ActivityChart';
import { actionLabel, whenShort } from '@/components/admin/activityFormat';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { palette, radii, spacing, typography } from '@/theme';

/** What each logged record type is called on screen. */
const KIND: Record<string, string> = {
  Payment: 'Payments',
  Booking: 'Jobs',
  ServiceRequest: 'Requests',
  SparePartOrder: 'Parts orders',
  ProviderProfile: 'Providers',
};

/** Admin activity log: what happened on the platform, newest first, with each record's number. */
export default function ActivityScreen() {
  const router = useRouter();
  const [kind, setKind] = useState('ALL');
  const activity = useAdminActivity({ limit: 50 });
  const stats = useAdminActivityStats();
  const refreshControl = useRefreshControl(() => Promise.all([activity.refetch(), stats.refetch()]));

  const logs = useMemo(() => activity.data?.items ?? [], [activity.data]);
  const kinds = useMemo(() => [...new Set(logs.map((l) => l.entityType).filter(Boolean) as string[])], [logs]);
  const visible = kind === 'ALL' ? logs : logs.filter((l) => l.entityType === kind);
  const days = stats.data?.days ?? [];

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        data={activity.isLoading ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Activity"
              subtitle={stats.data ? `${stats.data.totals.users} users, ${stats.data.totals.providers} providers` : 'What happened on Weyro'}
            />
            <View style={styles.card}>
              {days.length ? <ActivityChart days={days} /> : <Skeleton width="100%" height={180} />}
            </View>
            {kinds.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                <Chip label="All" selected={kind === 'ALL'} onPress={() => setKind('ALL')} />
                {kinds.map((k) => (
                  <Chip key={k} label={KIND[k] ?? k} selected={kind === k} onPress={() => setKind(k)} />
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.section}>Latest events</Text>
            {activity.isLoading
              ? [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={52} style={{ marginBottom: spacing.sm }} />)
              : null}
          </View>
        }
        ListEmptyComponent={
          activity.isLoading ? undefined : activity.isError ? (
            <ErrorState message="Check your connection and try again." onRetry={() => void activity.refetch()} />
          ) : (
            <EmptyState
              icon={<Activity size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={kind === 'ALL' ? 'No activity yet' : 'Nothing here'}
              message={kind === 'ALL' ? 'Platform events appear here as they happen.' : 'No events match this filter.'}
            />
          )
        }
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={item.entityRef ? () => router.push(`/admin-record/${item.entityRef}`) : undefined}
            disabled={!item.entityRef}
            accessibilityRole={item.entityRef ? 'button' : undefined}
            accessibilityLabel={`${actionLabel(item.action)}${item.entityRef ? `, ${item.entityRef}` : ''}`}
            scaleTo={0.99}
            style={[styles.row, index > 0 && styles.divider]}
          >
            <View style={styles.rowText}>
              <Text style={styles.action}>{actionLabel(item.action)}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.entityRef, item.actorRole ? item.actorRole.toLowerCase() : 'system'].filter(Boolean).join(', ')}
              </Text>
            </View>
            <Text style={styles.meta}>{whenShort(item.createdAt)}</Text>
          </PressableScale>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  filters: { gap: spacing.sm, paddingTop: spacing.md },
  section: { ...typography.section, color: palette.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  rowText: { flex: 1 },
  action: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
});
