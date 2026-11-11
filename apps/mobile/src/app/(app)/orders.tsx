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
        <StatusPill label={titleize(item.status)} tone={orderTone(item.status)} />
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

function DealerOrders() {
  const { data, isLoading } = useDealerOrders();
  const orders = data?.items ?? [];
  const revenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <FlatList
        data={isLoading ? [] : orders}
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
                  : `₹${revenue.toLocaleString('en-IN')} paid · ${orders.length} orders`
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
              title="No orders yet"
              message="Orders placed for your listings will appear here."
            />
          )
        }
        renderItem={({ item, index }) => (
          <View style={index > 0 ? styles.divider : undefined}>
            <OrderRow item={item} dealer />
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
