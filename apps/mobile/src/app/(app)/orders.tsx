import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDealerOrders } from '@/hooks/useParts';
import type { SparePartOrder } from '@/hooks/useParts';
import {
  ScreenContainer,
  AppHeader,
  Card,
  StatusPill,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export default function DealerOrdersScreen() {
  const { data, isLoading } = useDealerOrders();

  const orders = data?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader title="Orders" subtitle="Orders for your spare parts" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="100%" height={18} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title="Orders" subtitle="Orders for your spare parts" />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Orders placed for your parts will appear here."
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <OrderRow item={item} />}
        />
      )}
    </ScreenContainer>
  );
}

function OrderRow({ item }: { item: SparePartOrder }) {
  return (
    <TouchableOpacity
      style={styles.itemTouch}
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={`Order ${item.id.slice(0, 8)}, status ${item.status}`}
    >
      <Card style={styles.item}>
        <View style={styles.info}>
          <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
          <StatusPill label={item.status.replace(/_/g, ' ')} tone="neutral" />
          <Text style={styles.amount}>₹{item.totalAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.qty}>{item.quantity} x</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  itemTouch: { marginBottom: spacing.md },
  item: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1 },
  orderId: { ...typography.bodyMedium, color: palette.textPrimary, marginBottom: spacing.xs },
  amount: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { alignItems: 'flex-end' },
  qty: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.xs },
  date: { ...typography.label, color: palette.textMuted },
});
