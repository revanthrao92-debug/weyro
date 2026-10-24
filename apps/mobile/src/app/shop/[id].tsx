import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSparePart, useCreateSparePartOrder } from '@/hooks/useParts';
import { CostBreakdown } from '@/components/booking/CostBreakdown';
import {
  Button,
  ScreenContainer,
  AppHeader,
  Card,
  Avatar,
  StatusPill,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

type PartParams = { id: string };

export default function PartDetailScreen() {
  const { id } = useLocalSearchParams<PartParams>();
  const { data: part, isLoading } = useSparePart(id || '');
  const createOrder = useCreateSparePartOrder();
  const [ordering, setOrdering] = useState(false);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <ScreenContainer padded={false}>
        <AppHeader title="Part Details" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScreenContainer>
    );
  }

  if (!part) {
    return (
      <ScreenContainer padded={false}>
        <AppHeader title="Part Details" />
        <EmptyState title="Part not found" message="This part may have been removed." />
      </ScreenContainer>
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
    <ScrollView style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScreenContainer padded={false}>
        <AppHeader title={part.name} subtitle={part.partNumber} />
        <ScrollView contentContainerStyle={styles.body} scrollEnabled={false}>
          <Avatar name={part.name} size={100} uri={part.imageUrl ?? undefined} />

          <Card>
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
          </Card>

          <CostBreakdown parts={part.price} labour={0} total={part.price} />

          <Card style={styles.orderCard}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Text style={styles.qtyButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.stockText}>
              {inStock ? `In Stock (${part.stockQuantity} available)` : 'Out of Stock'}
            </Text>
            <Button
              title={inStock ? 'Create Order' : 'Out of Stock'}
              onPress={handleOrder}
              disabled={!inStock || ordering}
              loading={ordering}
            />
          </Card>
        </ScrollView>
      </ScreenContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  sectionTitle: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceAlt,
  },
  detailLabel: { ...typography.caption, color: palette.textSecondary },
  detailValue: { ...typography.captionMedium, color: palette.textPrimary },
  orderCard: { marginTop: spacing.md },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  qtyButtonText: { ...typography.heading, color: palette.textPrimary },
  qtyValue: { ...typography.bodyMedium, color: palette.textPrimary },
  stockText: { ...typography.captionMedium, color: palette.textSecondary, marginBottom: spacing.md },
});
