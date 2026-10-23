import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMyOrders, useCancelSparePartOrder } from '@/hooks/useParts';

export default function MyOrdersScreen() {
  const { data, isLoading, refetch } = useMyOrders();
  const cancelOrder = useCancelSparePartOrder();

  const orders = data ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>Your spare parts purchases</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text>No orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderItem item={item} />}
        />
      )}
    </View>
  );
}

function OrderItem({ item }: { item: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
        <Text style={styles.status}>{item.status}</Text>
        <Text style={styles.amount}>₹{item.totalAmount.toLocaleString()}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.qty}>{item.quantity} x</Text>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}

const styles = {
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1 },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#208AEF',
    marginBottom: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  meta: {
    alignItems: 'flex-end',
  },
  qty: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
} as any;
