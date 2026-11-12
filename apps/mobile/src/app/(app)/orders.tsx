import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Package } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  useDealerOrders,
  useMyOrders,
  type SparePartOrder,
} from '@/hooks/useParts';
import {
  ScreenContainer,
  Chip,
  PressableScale,
  StatusPill,
  EmptyState,
  Skeleton,
  Button,
} from '@/components/ui';
import {
  palette,
  spacing,
  typography,
  displayFamily,
  fontFamilyMono,
  type StatusTone,
} from '@/theme';
import { formatDate, titleize } from '@/utils/format';

function orderTone(status: string): StatusTone {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'PAID':
      return 'success';
    case 'CANCELLED':
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function OrderRow({
  item,
  dealer,
  onPress,
}: {
  item: SparePartOrder;
  dealer: boolean;
  onPress?: () => void;
}) {
  const part = item.sparePart?.name ?? 'Spare part';
  const who = item.customer
    ? `${item.customer.firstName} ${item.customer.lastName ?? ''}`.trim()
    : 'Customer';
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowKicker}>
          {formatDate(item.createdAt)} · qty {item.quantity}
        </Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {part}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {dealer ? who : item.sparePart?.partNumber ?? 'Order'}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>
          ₹{Number(item.totalAmount).toLocaleString('en-IN')}
        </Text>
        {dealer && item.status === 'PAID' ? (
          <StatusPill
            label={titleize(item.fulfillmentStatus ?? 'PENDING')}
            tone={fulfillmentTone(item.fulfillmentStatus)}
          />
        ) : (
          <StatusPill label={titleize(item.status)} tone={orderTone(item.status)} />
        )}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${part}, ${titleize(item.status)}`}
      scaleTo={0.99}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

function fulfillmentTone(status?: string): StatusTone {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'SHIPPED':
      return 'info';
    case 'READY':
      return 'info';
    case 'PROCESSING':
      return 'warning';
    default:
      return 'neutral';
  }
}

function OrdersHeader({
  eyebrow,
  title,
  summary,
}: {
  eyebrow: string;
  title: string;
  summary: string;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

function CustomerOrders() {
  const router = useRouter();
  const { data, isLoading } = useMyOrders();
  const orders = data ?? [];
  const open = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <FlatList
        data={isLoading ? [] : orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <View>
            <OrdersHeader
              eyebrow="Purchases"
              title="Part orders"
              summary={
                orders.length === 0
                  ? 'No orders yet'
                  : `${open} awaiting payment · ${orders.length} total`
              }
            />
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.rowText}>
                      <Skeleton width={110} height={10} />
                      <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
                    </View>
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              icon={<Package size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title="No part orders yet"
              message="Parts you order from the shop appear here with their payment state."
              action={
                <Button title="Browse parts" onPress={() => router.push('/shop')} />
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <View style={index > 0 ? styles.divider : undefined}>
            <OrderRow
              item={item}
              dealer={false}
              onPress={
                item.sparePart?.id
                  ? () => router.push(`/shop/${item.sparePart!.id}`)
                  : undefined
              }
            />
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const DEALER_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'TO_FULFILL', label: 'To fulfill' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'UNPAID', label: 'Unpaid' },
] as const;

function DealerOrders() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof DEALER_FILTERS)[number]['key']>('ALL');
  const { data, isLoading } = useDealerOrders({ limit: 50 });
  const orders = data?.items ?? [];

  const visible = orders.filter((order) => {
    switch (filter) {
      case 'TO_FULFILL':
        return (
          order.status === 'PAID' &&
          !['DELIVERED', 'CANCELLED'].includes(order.fulfillmentStatus ?? 'PENDING')
        );
      case 'SHIPPED':
        return order.fulfillmentStatus === 'SHIPPED';
      case 'DELIVERED':
        return order.fulfillmentStatus === 'DELIVERED';
      case 'UNPAID':
        return order.status === 'PENDING';
      default:
        return true;
    }
  });

  const toFulfill = orders.filter(
    (o) => o.status === 'PAID' && o.fulfillmentStatus !== 'DELIVERED',
  ).length;
  const revenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <View>
            <OrdersHeader
              eyebrow="Sales"
              title="Orders"
              summary={
                orders.length === 0
                  ? 'No orders yet'
                  : `${toFulfill} to fulfill · ₹${revenue.toLocaleString('en-IN')} paid`
              }
            />
            <View style={styles.filters}>
              {DEALER_FILTERS.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  selected={filter === item.key}
                  onPress={() => setFilter(item.key)}
                />
              ))}
            </View>
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.rowText}>
                      <Skeleton width={110} height={10} />
                      <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
                    </View>
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              icon={<Package size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={filter === 'ALL' ? 'No orders yet' : 'Nothing here'}
              message={
                filter === 'ALL'
                  ? 'Paid orders for your listings appear here.'
                  : 'No orders match this filter.'
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <View style={index > 0 ? styles.divider : undefined}>
            <OrderRow
              item={item}
              dealer
              onPress={() => router.push(`/order/${item.id}`)}
            />
          </View>
        )}
      />
    </ScreenContainer>
  );
}

export default function OrdersScreen() {
  const { role } = useAuth();
  return role === 'PROVIDER' || role === 'BOTH' ? <DealerOrders /> : <CustomerOrders />;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowText: { flex: 1 },
  rowKicker: { fontFamily: fontFamilyMono, fontSize: 10, color: palette.textMuted },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 3 },
  rowMeta: { ...typography.label, color: palette.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowPrice: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
