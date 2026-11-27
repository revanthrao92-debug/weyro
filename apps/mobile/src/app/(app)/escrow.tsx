import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Landmark } from 'lucide-react-native';
import { useAdminEscrow, type EscrowEntry } from '@/hooks/useAdmin';
import {
  Chip,
  EmptyState,
  ScreenContainer,
  Skeleton,
  StatusPill,
  ErrorState,
  PageHeader,
} from '@/components/ui';
import { formatDate, titleize, formatRupees as money } from '@/utils/format';
import { palette, spacing, typography, type StatusTone } from '@/theme';
import { useRefreshControl } from '@/hooks/useRefreshControl';

const FILTERS = ['ALL', 'HELD_IN_ESCROW', 'RELEASED_TO_PROVIDER', 'REFUNDED_TO_CUSTOMER', 'AWAITING_PAYMENT'] as const;
type Filter = (typeof FILTERS)[number];


function statusTone(status: string): StatusTone {
  if (status === 'RELEASED_TO_PROVIDER') return 'success';
  if (status === 'REFUNDED_TO_CUSTOMER') return 'danger';
  if (status === 'AWAITING_PAYMENT') return 'neutral';
  return 'warning';
}

function statusLabel(status: string) {
  if (status === 'HELD_IN_ESCROW') return 'Held';
  if (status === 'RELEASED_TO_PROVIDER') return 'Released';
  if (status === 'REFUNDED_TO_CUSTOMER') return 'Refunded';
  if (status === 'AWAITING_PAYMENT') return 'Not paid yet';
  return titleize(status);
}

export default function EscrowScreen() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data, isLoading, isError, refetch } = useAdminEscrow();
  const refreshControl = useRefreshControl(refetch);
  const entries = useMemo(() => data ?? [], [data]);

  const visible = useMemo(
    () => (filter === 'ALL' ? entries : entries.filter((item) => item.status === filter)),
    [entries, filter],
  );

  const totals = useMemo(() => {
    const sum = (status: EscrowEntry['status']) =>
      entries
        .filter((item) => item.status === status)
        .reduce((acc, item) => acc + Number(item.amount), 0);
    return {
      held: sum('HELD_IN_ESCROW'),
      released: sum('RELEASED_TO_PROVIDER'),
      refunded: sum('REFUNDED_TO_CUSTOMER'),
    };
  }, [entries]);

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        refreshControl={refreshControl}
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.paymentId ?? item.bookingId}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <PageHeader title="Payments" subtitle="Held, released to providers, and refunded" />
            <View style={styles.summary}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{money(totals.held)}</Text>
                <Text style={styles.summaryLabel}>Held</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{money(totals.released)}</Text>
                <Text style={styles.summaryLabel}>Released</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{money(totals.refunded)}</Text>
                <Text style={styles.summaryLabel}>Refunded</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((item) => (
                <Chip
                  key={item}
                  label={statusLabel(item)}
                  selected={filter === item}
                  onPress={() => setFilter(item)}
                />
              ))}
            </ScrollView>
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeleton}>
                    <Skeleton width="55%" height={16} />
                    <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
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
              icon={<Landmark size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={filter === 'ALL' ? 'No payments yet' : 'Nothing here'}
              message={
                filter === 'ALL'
                  ? 'Payments appear here when a booking is paid.'
                  : 'No payments match this state.'
              }
            />
          )
        }
        renderItem={({ item }) => <EscrowRow entry={item} />}
      />
    </ScreenContainer>
  );
}

function EscrowRow({ entry }: { entry: EscrowEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.amount}>{money(entry.amount)}</Text>
        <StatusPill label={statusLabel(entry.status)} tone={statusTone(entry.status)} />
      </View>
      <Text style={styles.parties} numberOfLines={1}>
        From {entry.customerName} to {entry.providerName}
      </Text>
      {/* Each number on its own line so it never breaks in the middle. */}
      <Text style={styles.meta} selectable>
        Payment {entry.paymentRef ?? `#${entry.bookingId.slice(0, 8).toUpperCase()}`}
      </Text>
      {entry.bookingRef ? (
        <Text style={styles.meta} selectable>
          For job {entry.bookingRef}
        </Text>
      ) : null}
      <Text style={styles.meta}>
        {[entry.bookingStatus ? `Job ${titleize(entry.bookingStatus).toLowerCase()}` : null, formatDate(entry.confirmedAt)]
          .filter(Boolean)
          .join(', ')}
      </Text>
      {entry.releasedAt ? (
        <Text style={styles.meta}>Released {formatDate(entry.releasedAt)}</Text>
      ) : null}
      {entry.payoutReference ? (
        <Text style={styles.meta}>Payout ref {entry.payoutReference}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  summary: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  summaryBlock: { flex: 1, gap: 2 },
  summaryValue: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  summaryLabel: { ...typography.caption, color: palette.textMuted },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  skeleton: { paddingVertical: spacing.md },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amount: { ...typography.heading, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  parties: { ...typography.body, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textMuted, flexShrink: 1 },
});
