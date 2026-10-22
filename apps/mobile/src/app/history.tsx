import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHistoryList } from '@/hooks/use-history-list';
import { apiClient } from '@/services/api-client';

/* ---------------------------------- types --------------------------------- */

interface HistoryItem {
  id: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

interface SparePartOrderItem extends HistoryItem {
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  sparePart: { id: string; name: string; partNumber: string; imageUrl?: string | null };
}

interface BookingItem extends HistoryItem {
  quotation?: {
    totalCost?: number | string;
    request?: { title?: string; category?: string } | null;
  } | null;
  provider?: { businessName?: string } | null;
}

interface RequestItem extends HistoryItem {
  title: string;
  category: string;
  urgency: string;
}

type TabKey = 'jobs' | 'requests' | 'parts';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'requests', label: 'Requests' },
  { key: 'parts', label: 'Spare Parts' },
];

const STATUS_LABEL: Record<string, string> = {
  // Booking statuses
  CONFIRMED: 'Confirmed',
  PROVIDER_EN_ROUTE: 'En Route',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  // Request statuses
  OPEN: 'Open',
  ACCEPTED: 'Accepted',
  PARTIALLY_ACCEPTED: 'Partially Accepted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  // Spare part order statuses
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

const STATUS_TONE: Record<string, 'neutral' | 'positive' | 'warning' | 'negative' | 'progress'> = {
  CONFIRMED: 'progress',
  PROVIDER_EN_ROUTE: 'progress',
  IN_PROGRESS: 'progress',
  COMPLETED: 'positive',
  OPEN: 'neutral',
  ACCEPTED: 'progress',
  PARTIALLY_ACCEPTED: 'warning',
  EXPIRED: 'negative',
  CANCELLED: 'negative',
  PENDING: 'warning',
  PAID: 'positive',
  FAILED: 'negative',
  REFUNDED: 'neutral',
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

/* ---------------------------------- screen --------------------------------- */

export default function HistoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<TabKey>('jobs');

  const fetcher = useMemo(
    () => async (cursor: string | null) => {
      if (activeTab === 'jobs') {
        return apiClient.get<{ items: BookingItem[]; nextCursor: string | null }>(
          '/bookings',
          { params: { cursor: cursor ?? undefined, limit: 20 } },
        );
      }
      if (activeTab === 'requests') {
        return apiClient.get<{ items: RequestItem[]; nextCursor: string | null }>(
          '/damage-requests/my',
          { params: { cursor: cursor ?? undefined, limit: 20 } },
        );
      }
      return apiClient.get<SparePartOrderItem[]>('/spare-parts/orders/my');
    },
    [activeTab],
  );

  const { items, isLoading, isRefreshing, isLoadingMore, error, refresh, loadMore, retry } =
    useHistoryList<HistoryItem>({ fetch: fetcher, key: activeTab });

  const styles = useMemo(
    () => makeStyles(theme),
    [theme],
  );

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const cancelOrder = useCallback(
    (order: SparePartOrderItem) => {
      Alert.alert(
        'Cancel this order?',
        `${order.sparePart?.name || 'This part'} will not be purchased. No payment has been taken for pending orders.`,
        [
          { text: 'Keep order', style: 'cancel' },
          {
            text: 'Cancel order',
            style: 'destructive',
            onPress: async () => {
              setCancellingId(order.id);
              try {
                await apiClient.post(
                  `/spare-parts/orders/${order.id}/cancel`,
                );
                await refresh();
              } catch (err: any) {
                Alert.alert(
                  'Unable to cancel',
                  err?.message || 'Please try again.',
                );
              } finally {
                setCancellingId(null);
              }
            },
          },
        ],
      );
    },
    [refresh],
  );

  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) => {
      if (activeTab === 'parts') {
        const order = item as SparePartOrderItem;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Spare part order ${order.sparePart?.name}`}
            style={styles.card}>
            <HistoryCardShell
              styles={styles}
              title={order.sparePart?.name || 'Spare part order'}
              subtitle={`Part #${order.sparePart?.partNumber || '—'} · Qty ${order.quantity}`}
              amount={rupees(order.totalAmount)}
              date={dayLabel(order.createdAt)}
              status={order.status}
              imageUrl={order.sparePart?.imageUrl || undefined}
            />
            {order.status === 'PENDING' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cancel order for ${order.sparePart?.name}`}
                disabled={cancellingId === order.id}
                onPress={() => cancelOrder(order)}
                style={styles.cancelBtn}>
                <ThemedText
                  type="smallBold"
                  style={styles.cancelBtnText}
                  themeColor="danger">
                  {cancellingId === order.id ? 'Cancelling…' : 'Cancel order'}
                </ThemedText>
              </Pressable>
            )}
          </Pressable>
        );
      }

      if (activeTab === 'requests') {
        const request = item as RequestItem;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Service request ${request.title}`}
            style={styles.card}>
            <HistoryCardShell
              styles={styles}
              title={request.title}
              subtitle={`${request.category} · ${request.urgency}`}
              date={dayLabel(request.createdAt)}
              status={request.status}
            />
          </Pressable>
        );
      }

      const booking = item as BookingItem;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Job ${booking.quotation?.request?.title || 'booking'}`}
          style={styles.card}>
          <HistoryCardShell
            styles={styles}
            title={booking.quotation?.request?.title || 'Service job'}
            subtitle={`${booking.quotation?.request?.category || 'Service'} · ${booking.provider?.businessName || ''}`}
            amount={
              booking.quotation?.totalCost
                ? rupees(Number(booking.quotation.totalCost))
                : undefined
            }
            date={dayLabel(booking.createdAt)}
            status={booking.status}
          />
        </Pressable>
      );
    },
    [activeTab, styles, cancellingId, cancelOrder],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabRow, { paddingTop: insets.top + Spacing.two }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}>
            <ThemedText
              type="smallBold"
              style={[
                styles.tabLabel,
                activeTab === tab.key && { color: theme.inverseText },
              ]}>
              {tab.label}
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
              accessibilityLabel="Retry loading history"
              onPress={retry}
              style={styles.retryBtn}>
              <ThemedText style={styles.retryText}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={styles.emptyTitle} themeColor="textSecondary">
              {activeTab === 'parts'
                ? 'No spare part orders yet'
                : activeTab === 'requests'
                  ? 'No service requests yet'
                  : 'No jobs yet'}
            </ThemedText>
            {activeTab === 'parts' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse spare parts"
                style={styles.retryBtn}
                onPress={() => router.push('/spare-parts')}>
                <ThemedText style={styles.retryText}>Browse Spare Parts</ThemedText>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
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
          />
        )}
      </View>
    </View>
  );
}

/* ------------------------------ card shell -------------------------------- */

function HistoryCardShell({
  styles,
  title,
  subtitle,
  amount,
  date,
  status,
  imageUrl,
}: {
  styles: ReturnType<typeof makeStyles>;
  title: string;
  subtitle: string;
  amount?: string;
  date: string;
  status: string;
  imageUrl?: string;
}) {
  const tone = STATUS_TONE[status] || 'neutral';

  return (
    <View style={styles.cardInner}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : null}
      <View style={styles.cardInfo}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <View style={[styles.chip, styles[`${tone}Chip`]]}>
            <ThemedText type="small" style={[styles.chipText, styles[`${tone}ChipText`]]}>
              {STATUS_LABEL[status] || status}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </ThemedText>
        <View style={styles.metaRow}>
          {amount ? (
            <ThemedText type="smallBold" style={styles.amount}>
              {amount}
            </ThemedText>
          ) : null}
          <ThemedText type="small" style={styles.date}>
            {date}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

/* --------------------------------- styles --------------------------------- */

const makeStyles = (theme: NonNullable<ReturnType<typeof useTheme>>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    tabRow: {
      paddingHorizontal: Spacing.three,
      gap: Spacing.one,
    },
    tab: {
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.round,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tabLabel: {
      color: theme.text,
    },
    content: {
      flex: 1,
      width: '100%',
      alignSelf: 'center',
    },
    list: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
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
      flexDirection: 'row',
      padding: Spacing.two,
      gap: Spacing.two,
    },
    cardInfo: {
      flex: 1,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.small,
      backgroundColor: theme.background,
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
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    amount: {
      color: theme.text,
    },
    date: {
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
    neutralChip: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    neutralChipText: {
      color: theme.text,
    },
    positiveChip: {
      backgroundColor: theme.primarySurface,
    },
    positiveChipText: {
      color: theme.primary,
    },
    progressChip: {
      backgroundColor: theme.info,
    },
    progressChipText: {
      color: theme.inverseText,
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
    emptyTitle: {
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
    cancelBtn: {
      alignSelf: 'flex-end',
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.two,
    },
    cancelBtnText: {
      fontSize: 12,
    },
  });
