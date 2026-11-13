import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Landmark } from 'lucide-react-native';
import { useAdminEscrow, type EscrowEntry } from '@/hooks/useAdmin';
import {
  AppHeader,
  Chip,
  EmptyState,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { formatDate, titleize } from '@/utils/format';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
  type StatusTone,
} from '@/theme';

const FILTERS = ['ALL', 'HELD_IN_ESCROW', 'RELEASED_TO_PROVIDER', 'REFUNDED_TO_CUSTOMER'] as const;
type Filter = (typeof FILTERS)[number];

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function statusTone(status: string): StatusTone {
  if (status === 'RELEASED_TO_PROVIDER') return 'success';
  if (status === 'REFUNDED_TO_CUSTOMER') return 'danger';
  return 'warning';
}

function statusLabel(status: string) {
  if (status === 'HELD_IN_ESCROW') return 'Held in escrow';
  if (status === 'RELEASED_TO_PROVIDER') return 'Released';
  if (status === 'REFUNDED_TO_CUSTOMER') return 'Refunded';
  return titleize(status);
}

export default function EscrowScreen() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data, isLoading } = useAdminEscrow();
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
      <AppHeader title="Escrow" subtitle="Payments held and released" />
      <FlatList
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.paymentId ?? item.bookingId}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
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
            <View style={styles.filters}>
              {FILTERS.map((item) => (
                <Chip
                  key={item}
                  label={statusLabel(item)}
                  selected={filter === item}
                  onPress={() => setFilter(item)}
                />
              ))}
            </View>
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
          isLoading ? undefined : (
            <EmptyState
              icon={<Landmark size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={filter === 'ALL' ? 'No payments yet' : 'Nothing here'}
              message={
                filter === 'ALL'
                  ? 'Escrow entries appear when bookings are paid.'
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
        {entry.customerName} → {entry.providerName}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          #{entry.bookingId.slice(0, 8).toUpperCase()}
          {entry.bookingStatus ? ` · ${titleize(entry.bookingStatus)}` : ''}
        </Text>
        <Text style={styles.meta}>{formatDate(entry.confirmedAt)}</Text>
      </View>
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
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  summary: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  summaryBlock: { flex: 1, gap: 2 },
  summaryValue: {
    fontFamily: fontFamilyMono,
    fontSize: 15,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: { ...typography.label, color: palette.textMuted },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  amount: {
    fontFamily: fontFamilyMono,
    fontSize: 18,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  parties: { ...typography.caption, color: palette.textPrimary },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  meta: { ...typography.label, color: palette.textMuted },
});
