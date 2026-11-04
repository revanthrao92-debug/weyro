import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Package } from 'lucide-react-native';
import { useDealerOrders } from '@/hooks/useParts';
import type { SparePartOrder } from '@/hooks/useParts';
import {
  ScreenContainer,
  AppHeader,
  StatusPill,
  EmptyState,
  Skeleton,
  FilterChips,
  AdBanner,
} from '@/components/ui';
import { photo, photoForCategory } from '@/lib/photos';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/format';


/**
 * Dealer orders — Checkpoint 3. Photo strip per order (part photo with
 * fallback), rigid labeled rows, filter chips. Cards are informational:
 * lifecycle actions are customer/admin side, so no fake buttons here.
 */

function orderTone(status: string) {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'PAID':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function DealerOrdersScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading } = useDealerOrders({ status: statusFilter });

  const orders = data?.items ?? [];

  const revenue = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const header =
    revenue > 0 ? (
      <View style={styles.revenueRow}>
        <Text style={styles.revenueLabel}>Paid this page</Text>
        <Text style={styles.revenueValue}>₹{revenue.toLocaleString()}</Text>
      </View>
    ) : undefined;

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark">
        <AppHeader title="Orders" subtitle="Orders for your spare parts" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={88} />
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Orders" subtitle="Orders for your spare parts" />

      <FilterChips
        options={[
          { label: 'All', value: 'ALL' },
          { label: 'Pending', value: 'PENDING' },
          { label: 'Paid', value: 'PAID' },
          { label: 'Cancelled', value: 'CANCELLED' },
        ]}
        value={statusFilter ?? 'ALL'}
        onChange={(value) => setStatusFilter(value === 'ALL' ? undefined : value)}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package size={28} color={palette.textMuted} />}
          title={statusFilter ? 'No orders in this state' : 'No orders yet'}
          message="Orders placed for your listings will appear here."
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListFooterComponent={
            <View style={{ marginTop: spacing.md }}>
              <AdBanner placement="shop-section" />
            </View>
          }
          renderItem={({ item }) => <OrderCard item={item} />}
        />
      )}
    </ScreenContainer>
  );
}

function OrderCard({ item }: { item: SparePartOrder }) {
  const partName = item.sparePart?.name ?? 'Spare part';
  const buyer = item.customer?.firstName
    ? `${item.customer.firstName} ${item.customer.lastName ?? ''}`.trim()
    : 'Customer';
  const photoUri = item.sparePart?.imageUrl || photo(photoForCategory(null));

  return (
    <View style={cardStyles.card}>
      {/* The moment: square product photo, engraved-style figure */}
      <View style={cardStyles.partRow}>
        <Image source={{ uri: photoUri }} style={cardStyles.partPhoto} contentFit="cover" />
        <View style={cardStyles.partInfo}>
          <Text style={cardStyles.partName} numberOfLines={1} maxFontSizeMultiplier={2}>
            {partName}
          </Text>
          <Text style={cardStyles.buyer} numberOfLines={1}>
            {buyer} · x{item.quantity}
          </Text>
          <Text style={cardStyles.figure} maxFontSizeMultiplier={2}>
            ₹{Number(item.totalAmount).toLocaleString()}
          </Text>
        </View>
        <StatusPill
          label={item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()}
          tone={orderTone(item.status)}
        />
      </View>

      <View style={cardStyles.divider} />

      <View style={cardStyles.body}>
        <View style={[cardStyles.row, cardStyles.rowDivider]}>
          <Text style={cardStyles.label}>Order</Text>
          <Text style={cardStyles.value}>#{item.id.slice(0, 8)}</Text>
        </View>
        <View style={[cardStyles.row, cardStyles.rowDivider]}>
          <Text style={cardStyles.label}>Unit price</Text>
          <Text style={cardStyles.value}>₹{Number(item.unitPrice).toLocaleString()}</Text>
        </View>
        <View style={cardStyles.row}>
          <Text style={cardStyles.label}>Placed</Text>
          <Text style={cardStyles.value}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  revenueLabel: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  revenueValue: {
    ...typography.heading,
    color: palette.textPrimary,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  partPhoto: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  partInfo: { flex: 1, gap: 2 },
  partName: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  buyer: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  figure: {
    ...typography.heading,
    fontFamily: displayFamily,
    color: palette.textPrimary,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  body: { paddingBottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  label: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  value: { ...typography.captionMedium, color: palette.textPrimary },
});
