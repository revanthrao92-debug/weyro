import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSparePart, useCreateSparePartOrder } from '@/hooks/useParts';
import { CostBreakdown } from '@/components/booking/CostBreakdown';

type PartParams = { id: string };

export default function PartDetailScreen() {
  const { id } = useLocalSearchParams<PartParams>();
  const { data: part, isLoading } = useSparePart(id || '');
  const createOrder = useCreateSparePartOrder();
  const [ordering, setOrdering] = useState(false);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!part) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>Part not found</Text>
      </View>
    );
  }

  const inStock = part.stockQuantity > 0;
  const maxQty = Math.min(part.stockQuantity, 10);

  const handleOrder = async () => {
    if (!inStock || quantity < 1 || quantity > maxQty) {
      Alert.alert('Error', 'Invalid quantity');
      return;
    }
    setOrdering(true);
    try {
      await createOrder.mutateAsync({ partId: part.id, quantity });
      Alert.alert('Order Created', 'Proceed to payment verification');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to create order');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ padding: 20 }}>
        <Text style={styles.title}>{part.name}</Text>
        <Text style={styles.partNumber}>{part.partNumber}</Text>

        <View style={styles.imagePlaceholder}>
          <Text style={styles.imageText}>🔧</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Condition</Text>
            <Text style={styles.detailValue}>
              {part.condition.charAt(0).toUpperCase() + part.condition.slice(1)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Compatible Makes</Text>
            <Text style={styles.detailValue}>{part.compatibleMakes.join(', ')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Compatible Models</Text>
            <Text style={styles.detailValue}>{part.compatibleModels.join(', ')}</Text>
          </View>
        </View>

        <CostBreakdown parts={part.price} labour={0} total={part.price} />

        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantitySelector}>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Text style={styles.qtyButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
            >
              <Text style={styles.qtyButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stockText}>
            {inStock ? `In Stock (${part.stockQuantity} available)` : 'Out of Stock'}
          </Text>
          <TouchableOpacity
            style={[styles.orderButton, !inStock ? styles.orderButtonDisabled : {}]}
            onPress={handleOrder}
            disabled={!inStock || ordering}
          >
            {ordering ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.orderButtonText}>
                {inStock ? 'Create Order' : 'Out of Stock'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = {
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  partNumber: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  imageText: {
    fontSize: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  orderSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  qtyButtonText: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    color: (p: { stockQuantity: number }) => (p.stockQuantity > 0 ? '#10B981' : '#EF4444'),
    marginBottom: 12,
  },
  orderButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  orderButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
} as any;
