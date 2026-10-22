import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHistoryList } from '@/hooks/use-history-list';
import { apiClient } from '@/services/api-client';

interface AdminOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  status: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  sparePart: { id: string; name: string; partNumber: string };
  customer: { firstName: string; lastName: string } | null;
  provider: { businessName: string } | null;
}

type StatusFilter = 'ALL' | 'PENDING' | 'PAID' | 'CANCELLED' | 'FAILED';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PAID', label: 'Paid' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'FAILED', label: 'Failed' },
];

const STATUS_TONE: Record<string, 'positive' | 'warning' | 'negative'> = {
  PAID: 'positive',
  PENDING: 'warning',
  CANCELLED: 'negative',
  FAILED: 'negative',
};

const rupees = (amount: number) => `₹${Number(amount).toLocaleString('en-IN')}`;

const dayLabel = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function AdminOrdersScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<StatusFilter>('ALL');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const fetcher = useMemo(
    () => async (cursor: string | null) => {
      return apiClient.get<{ items: AdminOrderItem[]; nextCursor: string | null }>(
        '/spare-parts/orders/admin/all',
        {
          params: {
            cursor: cursor ?? undefined,
            limit: 20,
            status: filter === 'ALL' ? undefined : filter,
          },
        },
      );
    },
    [filter],
  );

  const { items, isLoading, isRefreshing, isLoadingMore, error, refresh, loadMore, retry } =
    useHistoryList<AdminOrderItem>({ fetch: fetcher, key: filter });

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, order) => {
        acc.total += 1;
        if (order.status === 'PAID') acc.paid += 1;
        if (order.status === 'PENDING') acc.pending += 1;
        return acc;
      },
      { total: 0, paid: 0, pending: 0 },
    );
  }, [items]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}>
          <ThemedText style={styles.backText}>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.headerTitle}>
          All Spare Part Orders
        </ThemedText>
      </View>

      {/* Summary row */}
      <View style={[styles.summaryRow, { maxWidth: MaxContentWidth }]}>
        <View style={styles.summaryCard}>
          <ThemedText type="smallBold" style={styles.summaryValue}>
            {summary.total}
          </ThemedText>
          <ThemedText type="small" style={styles.summaryLabel}>
            Total
          </ThemedText>
        </View>
        <View style={styles.summaryCard}>
          <ThemedText type="smallBold" style={styles.summaryValue}>
            {summary.paid}
          </ThemedText>
          <ThemedText type="small" style={styles.summaryLabel}>
            Paid
          </ThemedText>
        </View>
        <View style={styles.summaryCard}>
          <ThemedText type="smallBold" style={styles.summaryValue}>
            {summary.pending}
          </ThemedText>
          <ThemedText type="small" style={styles.summaryLabel}>
            Pending
          </ThemedText>
        </View>
      </View>

      {/* Status filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
            <ThemedText
              type="small"
              style={[styles.filterText, filter === f.key && { color: theme.inverseText }]}>
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.content, { maxWidth: MaxContentWidth }]}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ThemedText style={styles.error} themeColor="danger">
              {error}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading orders"
              onPress={retry}
              style={styles.retryBtn}>
              <ThemedText style={styles.retryText}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={styles.empty} themeColor="textSecondary">
              No orders match this filter.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + Spacing.six },
            ]}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isLoadingMore ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.two }} />
              ) : null
            }
            renderItem={({ item }) => {
              const tone = STATUS_TONE[item.status] || 'warning';
              const expanded = expandedId === item.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${item.id}, status ${item.status}`}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                  style={styles.card}>
                  <View style={styles.cardInner}>
                    <View style={styles.cardInfo}>
                      <View style={styles.titleRow}>
                        <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
                          {item.sparePart?.name || 'Spare part order'}
                        </ThemedText>
                        <View style={[styles.chip, styles[`${tone}Chip`]]}>
                          <ThemedText
                            type="small"
                            style={[styles.chipText, styles[`${tone}ChipText`]]}>
                            {item.status}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText type="small" style={styles.subtitle} numberOfLines={1}>
                        {item.provider?.businessName || 'Unknown dealer'} ·{' '}
                        {item.customer
                          ? `${item.customer.firstName} ${item.customer.lastName}`
                          : 'Customer'}
                      </ThemedText>
                      <View style={styles.metaRow}>
                        <ThemedText type="smallBold" style={styles.amount}>
                          {rupees(item.totalAmount)}
                        </ThemedText>
                        <ThemedText type="small" style={styles.date}>
                          · Qty {item.quantity} · {dayLabel(item.createdAt)}
                        </ThemedText>
                      </View>
                      {expanded && (
                        <View style={styles.reconBlock}>
                          <ThemedText type="small" style={styles.reconLine}>
                            Gateway Order: {item.gatewayOrderId || '—'}
                          </ThemedText>
                          <ThemedText type="small" style={styles.reconLine}>
                            Gateway Payment: {item.gatewayPaymentId || '—'}
                          </ThemedText>
                          <ThemedText type="small" style={styles.reconLine}>
                            Paid At:{' '}
                            {item.paidAt ? dayLabel(item.paidAt as string) : 'Not paid'}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: NonNullable<ReturnType<typeof useTheme>>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
    },
    backBtn: {
      paddingVertical: Spacing.one,
      paddingRight: Spacing.two,
    },
    backText: {
      fontSize: 18,
      color: theme.primary,
    },
    headerTitle: {
      fontSize: 17,
      color: theme.text,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      marginTop: Spacing.two,
      width: '100%',
      alignSelf: 'center',
    },
    summaryCard: {
      flex: 1,
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: Spacing.two,
      alignItems: 'center',
    },
    summaryValue: {
      color: theme.text,
    },
    summaryLabel: {
      color: theme.textSecondary,
    },
    filterRow: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: Spacing.one,
    },
    filterChip: {
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.round,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    filterText: {
      color: theme.text,
    },
    content: {
      flex: 1,
      width: '100%',
      alignSelf: 'center',
    },
    list: {
      paddingHorizontal: Spacing.three,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: Spacing.two,
      ...Elevation.low,
    },
    cardInner: {
      padding: Spacing.two,
    },
    cardInfo: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    title: {
      flexShrink: 1,
      color: theme.text,
    },
    subtitle: {
      color: theme.textSecondary,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.one,
    },
    amount: {
      color: theme.text,
    },
    date: {
      color: theme.textSecondary,
    },
    reconBlock: {
      marginTop: Spacing.two,
      padding: Spacing.two,
      borderRadius: BorderRadius.small,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 2,
    },
    reconLine: {
      color: theme.textSecondary,
    },
    chip: {
      paddingHorizontal: Spacing.one,
      paddingVertical: 2,
      borderRadius: BorderRadius.round,
    },
    chipText: {
      fontSize: 10,
      fontWeight: '700',
    },
    positiveChip: {
      backgroundColor: theme.primarySurface,
    },
    positiveChipText: {
      color: theme.primary,
    },
    warningChip: {
      backgroundColor: theme.warningSurface,
    },
    warningChipText: {
      color: theme.warning,
    },
    negativeChip: {
      backgroundColor: theme.danger,
    },
    negativeChipText: {
      color: theme.inverseText,
    },
    error: {
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    empty: {
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: Spacing.two,
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.primarySurface,
    },
    retryText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 13,
    },
  });
