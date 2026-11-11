import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyRequests, type ServiceRequest } from '@/hooks/useRequests';
import {
  ScreenContainer,
  PressableScale,
  Chip,
  StatusPill,
  EmptyState,
  Skeleton,
  Button,
} from '@/components/ui';
import {
  StatusTone,
  palette,
  spacing,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { formatDate, labelize } from '@/utils/format';

const FILTERS = ['OPEN', 'QUOTES_RECEIVED', 'ACCEPTED', 'CANCELLED', 'COMPLETED'];

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'QUOTES_RECEIVED':
      return 'info';
    case 'OPEN':
    case 'ACCEPTED':
      return 'neutral';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function RequestRow({
  item,
  divider,
  onPress,
}: {
  item: ServiceRequest;
  divider: boolean;
  onPress: () => void;
}) {
  const quotes = item.quotationsCount ?? 0;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${labelize(item.status)}, ${quotes} quotes`}
      scaleTo={0.99}
      style={[styles.row, divider && styles.rowDivider]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowKicker}>
          {formatDate(item.createdAt)} · {quotes} {quotes === 1 ? 'quote' : 'quotes'}
        </Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {labelize(item.category)} · {labelize(item.urgency)}
        </Text>
      </View>
      <StatusPill label={labelize(item.status)} tone={statusTone(item.status)} />
    </PressableScale>
  );
}

export default function MyRequestsScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const router = useRouter();
  const { data, isLoading } = useMyRequests();

  const all = data?.items ?? [];
  const requests = statusFilter
    ? all.filter((r) => r.status === statusFilter)
    : all;
  const openCount = all.filter((r) =>
    ['OPEN', 'QUOTES_RECEIVED'].includes(r.status)
  ).length;

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Requests</Text>
        <Text style={styles.title}>Your requests</Text>
        <Text style={styles.summary}>
          {all.length === 0
            ? 'No requests yet'
            : `${openCount} open · ${all.length} total`}
        </Text>

        {isLoading ? (
          <View style={styles.loading}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.rowText}>
                  <Skeleton width={110} height={10} />
                  <Skeleton width="65%" height={16} style={{ marginTop: 8 }} />
                  <Skeleton width="45%" height={10} style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        ) : all.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              title="No requests yet"
              message="Post a request with photos and verified garages will send you quotes."
              action={
                <Button
                  title="Post a request"
                  onPress={() => router.push('/requests/create')}
                />
              }
            />
          </View>
        ) : (
          <>
            <View style={styles.filterRow}>
              {FILTERS.map((s) => (
                <Chip
                  key={s}
                  label={labelize(s)}
                  selected={statusFilter === s}
                  onPress={() =>
                    setStatusFilter((prev) => (prev === s ? undefined : s))
                  }
                />
              ))}
            </View>

            {requests.length === 0 ? (
              <View style={styles.empty}>
                <EmptyState
                  title={`No ${labelize(statusFilter ?? '').toLowerCase()} requests`}
                  message="Clear the filter to see your other requests."
                  action={
                    <Button
                      title="Clear filter"
                      variant="secondary"
                      onPress={() => setStatusFilter(undefined)}
                    />
                  }
                />
              </View>
            ) : (
              <View style={styles.list}>
                {requests.map((item, index) => (
                  <RequestRow
                    key={item.id}
                    item={item}
                    divider={index > 0}
                    onPress={() => router.push(`/requests/${item.id}`)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
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
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  loading: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowText: { flex: 1 },
  rowKicker: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 3 },
  rowMeta: { ...typography.label, color: palette.textSecondary, marginTop: 2 },
  empty: { marginTop: spacing.lg },
});
