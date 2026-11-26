import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSparePart, useCreateSparePartOrder } from '@/hooks/useParts';
import {
  ScreenContainer,
  BackButton,
  Button,
  Input,
  PressableScale,
  SectionHead,
  StatusPill,
  Skeleton,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import {
  palette,
  spacing,
  radii,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { isNotFound } from '@/services/api-client';
import { formatRupees } from '@/utils/format';

type PartParams = { id: string };

export default function PartDetailScreen() {
  const { id } = useLocalSearchParams<PartParams>();
  const router = useRouter();
  const { data: part, isLoading, isError, error, refetch } = useSparePart(id || '');
  const createOrder = useCreateSparePartOrder();
  const [ordering, setOrdering] = useState(false);
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <BackButton />
        <Skeleton width="70%" height={24} style={{ marginTop: spacing.md }} />
        <Skeleton width="100%" height={180} style={{ marginTop: spacing.lg }} />
        <Skeleton width="60%" height={14} style={{ marginTop: spacing.lg }} />
      </ScreenContainer>
    );
  }

  if (!part) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <BackButton />
        {isError && !isNotFound(error) ? (
          <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
        ) : (
          <EmptyState title="Part not found" message="This part may have been removed." />
        )}
      </ScreenContainer>
    );
  }

  const available = part.inStock ?? (part.stockQuantity ?? 0) > 0;
  const inStock = available;
  const maxQty = 10;
  const total = Number(part.price) * quantity;
  const validShipping =
    shippingName.trim().length > 1 &&
    shippingPhone.trim().length >= 8 &&
    shippingAddress.trim().length >= 5 &&
    shippingCity.trim().length >= 2 &&
    /^\d{4,6}$/.test(shippingPincode.trim());

  const handleOrder = async () => {
    if (!inStock || quantity < 1 || quantity > maxQty) {
      Alert.alert('Error', 'Invalid quantity');
      return;
    }
    if (!validShipping) {
      Alert.alert('Delivery details needed', 'Add a name, phone and delivery address first.');
      return;
    }
    setOrdering(true);
    try {
      await createOrder.mutateAsync({
        partId: part.id,
        quantity,
        shippingName: shippingName.trim(),
        shippingPhone: shippingPhone.trim(),
        shippingAddress: shippingAddress.trim(),
        shippingCity: shippingCity.trim(),
        shippingPincode: shippingPincode.trim(),
      });
      // The order exists now; it appears in Orders with its payment state.
      router.replace('/my-orders');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to create order');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.topLabel}>Part</Text>
          <View style={styles.spacer} />
        </View>

        {part.imageUrl ? (
          <Image
            source={{ uri: part.imageUrl }}
            style={styles.hero}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.hero, styles.heroEmpty]}>
            <Text style={styles.heroPartNumber}>{part.partNumber}</Text>
            <Text style={styles.heroEmptyLabel}>No photo provided</Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{part.name}</Text>
            <Text style={styles.partNumber}>{part.partNumber}</Text>
          </View>
          <Text style={styles.price}>{formatRupees(part.price)}</Text>
        </View>

        <View style={styles.pills}>
          <StatusPill label={part.condition} tone="neutral" />
          <StatusPill
            label={inStock ? 'Available' : 'Out of stock'}
            tone={inStock ? 'success' : 'danger'}
          />
        </View>

        {part.description ? (
          <Text style={styles.description}>{part.description}</Text>
        ) : null}

        <SectionHead title="Fitment" />
        <View style={styles.spec}>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Makes</Text>
            <Text style={styles.specValue}>
              {part.compatibleMakes.length ? part.compatibleMakes.join(', ') : 'Universal'}
            </Text>
          </View>
          <View style={[styles.specRow, styles.specRowDivider]}>
            <Text style={styles.specLabel}>Models</Text>
            <Text style={styles.specValue}>
              {part.compatibleModels.length ? part.compatibleModels.join(', ') : 'Universal'}
            </Text>
          </View>
          <View style={[styles.specRow, styles.specRowDivider]}>
            <Text style={styles.specLabel}>Condition</Text>
            <Text style={styles.specValue}>{part.condition}</Text>
          </View>
        </View>

        <SectionHead title="Order" />
        <View style={styles.orderPanel}>
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Quantity</Text>
            <View style={styles.quantity}>
              <PressableScale
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                scaleTo={0.94}
                style={[styles.qtyButton, quantity <= 1 && styles.qtyDisabled]}
              >
                <Text style={styles.qtyButtonText}>−</Text>
              </PressableScale>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <PressableScale
                onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                scaleTo={0.94}
                style={[styles.qtyButton, quantity >= maxQty && styles.qtyDisabled]}
              >
                <Text style={styles.qtyButtonText}>+</Text>
              </PressableScale>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.orderLabel}>Total</Text>
            <Text style={styles.total}>{formatRupees(total)}</Text>
          </View>

          <SectionHead title="Delivery details" />
          <Input
            label="Full name"
            placeholder="Who receives the part"
            value={shippingName}
            onChangeText={setShippingName}
          />
          <Input
            label="Phone"
            placeholder="+91…"
            value={shippingPhone}
            onChangeText={setShippingPhone}
            keyboardType="phone-pad"
          />
          <Input
            label="Address"
            placeholder="Street, area, landmark"
            value={shippingAddress}
            onChangeText={setShippingAddress}
            multiline
            style={styles.addressInput}
          />
          <Input
            label="City"
            placeholder="City"
            value={shippingCity}
            onChangeText={setShippingCity}
          />
          <Input
            label="Pincode"
            placeholder="560001"
            value={shippingPincode}
            onChangeText={setShippingPincode}
            keyboardType="number-pad"
          />

          <Button
            title={inStock ? 'Create order' : 'Out of stock'}
            onPress={handleOrder}
            disabled={!inStock || ordering || !validShipping}
            loading={ordering}
          />
          <Text style={styles.orderNote}>
            Payment collection is not available in the app yet. The order is recorded and its payment state appears in Orders.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  addressInput: { minHeight: 72, textAlignVertical: 'top' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  topLabel: { ...typography.label, color: palette.textMuted },
  spacer: { width: 44 },
  hero: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  heroPartNumber: { fontFamily: fontFamilyMono, fontSize: 13, color: palette.textSecondary },
  heroEmptyLabel: { ...typography.label, color: palette.textMuted },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: displayFamily,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: palette.textPrimary,
  },
  partNumber: {
    fontFamily: fontFamilyMono,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 4,
  },
  price: {
    fontSize: 22,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  description: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.md,
  },
  spec: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  specRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  specLabel: { ...typography.caption, color: palette.textSecondary },
  specValue: {
    ...typography.captionMedium,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  orderPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: spacing.md,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  orderLabel: { ...typography.caption, color: palette.textSecondary },
  quantity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  qtyDisabled: { opacity: 0.4 },
  qtyButtonText: { ...typography.heading, color: palette.textPrimary },
  qtyValue: { fontSize: 16, color: palette.textPrimary },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  total: {
    fontSize: 20,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  orderNote: {
    ...typography.label,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
