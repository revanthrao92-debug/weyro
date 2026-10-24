import { useState } from 'react';
import { FlatList, Text, View, ActivityIndicator, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useMyOrders, useCancelSparePartOrder } from '@/hooks/useParts';
import {
  ScreenContainer,
  AppHeader,
  Card,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
  BackButton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export default function MyOrdersScreen() {
  const { data, isLoading, refetch } = useMyOrders();
  const cancelOrder = useCancelSparePartOrder();

  const orders = data ?? [];

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader left={<BackButton />} title="My Orders" subtitle="Your spare parts purchases" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="100%" height={18} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  const handleCancelOrder = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Cancel Order',
        'Are you sure you want to cancel this order?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cancel Order', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;
    try {
      await cancelOrder.mutateAsync(id);
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to cancel order');
    }
  };

  return (
    <ScreenContainer>
      <AppHeader left={<BackButton />} title="My Orders" subtitle="Your spare parts purchases" />

      {orders.length === 0 ? (
        <EmptyState title="No orders yet" message="Your spare parts purchases will appear here." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <OrderItem item={item} onCancel={handleCancelOrder} />}
        />
      )}
    </ScreenContainer>
  );
}

function OrderItem({ item, onCancel }: { item: any; onCancel: (id: string) => void }) {
  return (
    <TouchableOpacity
      style={styles.itemTouch}
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={`Order ${item.id.slice(0, 8)}`}
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
      {item.status === 'PENDING' && (
        <Button
          title="Cancel"
          variant="destructive"
          onPress={() => onCancel(item.id)}
          style={styles.cancelBtn}
        />
      )}
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
    marginBottom: spacing.md,
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
  cancelBtn: { minWidth: 100 },
});
