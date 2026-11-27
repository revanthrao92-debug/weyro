import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import {
  useAdminActivity,
  useAdminActivityStats,
} from '@/hooks/useAdmin';
import {
  AppHeader,
  Chip,
  EmptyState,
  ScreenContainer,
  Skeleton,
} from '@/components/ui';
import { formatDate } from '@/utils/format';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';

function actionLabel(action: string) {
  const [head, ...rest] = action.split(/[._]/);
  return [
    head.charAt(0).toUpperCase() + head.slice(1).toLowerCase(),
    ...rest.map((part) => part.toLowerCase()),
  ].join(' ');
}

export default function ActivityScreen() {
  const [entity, setEntity] = useState('ALL');
  const { data, isLoading, refetch, isRefetching } = useAdminActivity({ limit: 50 });
  const stats = useAdminActivityStats();

  const logs = useMemo(() => data?.items ?? [], [data]);
  const entities = useMemo(
    () =>
      Array.from(
        new Set(logs.map((log) => log.entityType).filter(Boolean) as string[]),
      ).slice(0, 5),
    [logs],
  );
  const visible =
    entity === 'ALL' ? logs : logs.filter((log) => log.entityType === entity);

  const days = stats.data?.days ?? [];
  const maxDay = Math.max(
    1,
    ...days.map(
      (day) =>
        day.requests + day.bookings + day.quotations + day.sparePartOrders,
    ),
  );

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader title="Activity" subtitle="Platform audit trail" />
      <FlatList
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={palette.textSecondary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.chart}>
              {days.map((day) => {
                const total =
                  day.requests +
                  day.bookings +
                  day.quotations +
                  day.sparePartOrders;
                return (
                  <View key={day.date} style={styles.chartCol}>
                    <View style={styles.chartTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: Math.max(4, (total / maxDay) * 72),
                            backgroundColor:
                              day.date === days[days.length - 1]?.date
                                ? palette.accent
                                : palette.borderStrong,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartLabel}>
                      {new Date(`${day.date}T00:00:00.000Z`).getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {logs.length} events · {stats.data?.totals.users ?? 0} users ·{' '}
                {stats.data?.totals.providers ?? 0} providers
              </Text>
            </View>

            <View style={styles.filters}>
              <Chip
                label="All"
                selected={entity === 'ALL'}
                onPress={() => setEntity('ALL')}
              />
              {entities.map((item) => (
                <Chip
                  key={item}
                  label={item.charAt(0) + item.slice(1).toLowerCase()}
                  selected={entity === item}
                  onPress={() => setEntity(item)}
                />
              ))}
            </View>

            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeleton}>
                    <Skeleton width="65%" height={15} />
                    <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              icon={<Activity size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={entity === 'ALL' ? 'No activity yet' : 'Nothing here'}
              message={
                entity === 'ALL'
                  ? 'Platform events will appear here as they happen.'
                  : 'No events match this filter.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.action}>{actionLabel(item.action)}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {item.actorRole?.toLowerCase() ?? 'system'}
              {item.entityType ? `, ${item.entityType}` : ''}
              {item.entityRef ? `, ${item.entityRef}` : ''}
            </Text>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartTrack: { height: 72, justifyContent: 'flex-end', width: '100%' },
  chartBar: { width: '100%', borderRadius: 2 },
  chartLabel: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
  summaryRow: { paddingVertical: spacing.sm },
  summaryText: { ...typography.label, color: palette.textMuted },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  skeleton: { paddingVertical: spacing.md },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  action: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    flex: 1,
  },
  date: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
  meta: { ...typography.label, color: palette.textMuted },
});
