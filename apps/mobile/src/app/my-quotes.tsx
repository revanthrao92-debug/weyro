import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, Alert } from 'react-native';
import { useMyQuotations, useWithdrawQuotation } from '@/hooks/useRequests';
import {
  ScreenContainer,
  AppHeader,
  Card,
  Chip,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
  BackButton,
  FilterBar,
} from '@/components/ui';
import { StatusTone, palette, spacing, typography } from '@/theme';

const FILTERS = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'];

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'danger';
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export default function MyQuotesScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading, refetch } = useMyQuotations({ status: statusFilter });
  const withdrawQuotation = useWithdrawQuotation();

  const quotes = data?.items ?? [];
  const showFilters = quotes.length > 0 || !!statusFilter;

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="My Quotes" subtitle="Your sent quotations" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="30%" height={22} style={{ marginTop: spacing.sm }} />
            <Skeleton width="50%" height={12} style={{ marginTop: spacing.sm }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  const handleWithdraw = async (id: string) => {
    try {
      await withdrawQuotation.mutateAsync(id);
      Alert.alert('Success', 'Quotation withdrawn');
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to withdraw quotation');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader left={<BackButton />} title="My Quotes" subtitle="Your sent quotations" />

      {showFilters ? (
        <FilterBar>
          <View style={styles.filterRow}>
        {FILTERS.map((s) => (
          <Chip
            key={s}
            label={labelize(s)}
            selected={statusFilter === s}
            onPress={() => setStatusFilter((prev) => (prev === s ? undefined : s))}
          />
        ))}
          </View>
        </FilterBar>
      ) : null}

      {quotes.length === 0 ? (
        <EmptyState
          title={statusFilter ? 'No quotes match this filter' : 'No quotes yet'}
          message={statusFilter ? 'Try a different status.' : 'Quotations you send will appear here.'}
        />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <QuoteItem item={item} onWithdraw={handleWithdraw} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function QuoteItem({ item, onWithdraw }: { item: any; onWithdraw: (id: string) => void }) {
  const canWithdraw = item.status === 'PENDING';

  return (
    <Card style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.quoteTitle}>Quotation</Text>
        <Text style={styles.quoteAmount}>₹{item.totalCost.toLocaleString()}</Text>
        <View style={styles.metaRow}>
          <StatusPill label={labelize(item.status)} tone={statusTone(item.status)} />
        </View>
        {item.etaDescription ? (
          <Text style={styles.quoteETA}>{item.etaDescription}</Text>
        ) : null}
      </View>
      {canWithdraw && (
        <Button
          title="Withdraw"
          variant="destructive"
          onPress={() => onWithdraw(item.id)}
          style={styles.withdrawBtn}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: { paddingBottom: spacing.xl },
  skeletonCard: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  info: { flex: 1 },
  quoteTitle: { ...typography.label, color: palette.textSecondary },
  quoteAmount: { ...typography.title, color: palette.textPrimary, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', marginTop: spacing.sm },
  quoteETA: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.sm },
  withdrawBtn: { minWidth: 104 },
});
