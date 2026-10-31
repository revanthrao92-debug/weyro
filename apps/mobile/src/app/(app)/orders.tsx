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
import { formatDate } from '@/utils/format';
import { palette, spacing, radii, typography } from '@/theme';

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
        <Text style={styles.revenueLabel}>PAID REVENUE (THIS PAGE)</Text>
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
      <View style={cardStyles.photoHeader}>
        <Image source={{ uri: photoUri }} style={cardStyles.photo} contentFit="cover" />
        <View style={cardStyles.photoShade} />
        <View style={cardStyles.photoInner}>
          <View style={{ flexShrink: 1 }}>
            <Text style={cardStyles.partName} numberOfLines={1} maxFontSizeMultiplier={2}>
              {partName}
            </Text>
            <Text style={cardStyles.buyer} numberOfLines={1}>
              {buyer} · x{item.quantity}
            </Text>
          </View>
          <StatusPill
            label={item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()}
            tone={orderTone(item.status)}
          />
        </View>
      </View>

      <View style={cardStyles.body}>
        <View style={[cardStyles.row, cardStyles.rowDivider]}>
          <Text style={cardStyles.label}>ORDER ID</Text>
          <Text style={cardStyles.value}>#{item.id.slice(0, 8)}</Text>
        </View>
        <View style={[cardStyles.row, cardStyles.rowDivider]}>
          <Text style={cardStyles.label}>UNIT PRICE</Text>
          <Text style={cardStyles.value}>₹{Number(item.unitPrice).toLocaleString()}</Text>
        </View>
        <View style={[cardStyles.row, cardStyles.rowDivider]}>
          <Text style={cardStyles.label}>TOTAL</Text>
          <Text style={cardStyles.amount}>₹{Number(item.totalAmount).toLocaleString()}</Text>
        </View>
        <View style={cardStyles.row}>
          <Text style={cardStyles.label}>PLACED</Text>
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
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photoHeader: {
    height: 76,
    justifyContent: 'flex-end',
  },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  photoShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 21, 30, 0.66)',
  },
  photoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  partName: {
    ...typography.heading,
    color: palette.onHeader,
  },
  buyer: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: 2,
  },
  body: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  label: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  value: { ...typography.captionMedium, color: palette.textPrimary },
  amount: { ...typography.bodyMedium, color: palette.textPrimary },
});
