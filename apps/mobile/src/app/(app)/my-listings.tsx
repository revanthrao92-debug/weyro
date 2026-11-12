import { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useMyParts, useDeleteSparePart, useUpdateSparePart, type SparePart } from '@/hooks/useParts';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  EmptyState,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';
import { formatDate } from '@/utils/format';

const FILTERS = ['ALL', 'ACTIVE', 'INACTIVE', 'LOW_STOCK'] as const;

function stockLabel(part: SparePart) {
  if (stockOf(part) <= 0) return 'Out of stock';
  if (stockOf(part) <= 3) return `Low stock · ${stockOf(part)}`;
  return `${stockOf(part)} in stock`;
}

function stockOf(part: SparePart) {
  return part.stockQuantity ?? 0;
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch } = useMyParts({ limit: 50 });
  const updatePart = useUpdateSparePart();
  const deletePart = useDeleteSparePart();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');

  const parts = data?.items ?? [];
  const visible = parts.filter((part) => {
    if (filter === 'ACTIVE') return part.isActive;
    if (filter === 'INACTIVE') return !part.isActive;
    if (filter === 'LOW_STOCK') return stockOf(part) <= 3;
    return true;
  });

  const active = parts.filter((part) => part.isActive).length;
  const lowStock = parts.filter((part) => stockOf(part) <= 3).length;
  const inventoryValue = parts
    .filter((part) => part.isActive)
    .reduce((sum, part) => sum + Number(part.price) * stockOf(part), 0);

  const setStock = async (part: SparePart, next: number) => {
    if (next < 0) return;
    try {
      await updatePart.mutateAsync({ id: part.id, stockQuantity: next });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update stock.');
    }
  };

  const toggleActive = async (part: SparePart) => {
    try {
      await updatePart.mutateAsync({ id: part.id, isActive: !part.isActive });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update listing.');
    }
  };

  const remove = async (part: SparePart) => {
    try {
      await deletePart.mutateAsync(part.id);
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not delete listing.');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader title="Listings" subtitle="Price, stock and visibility" />
      <FlatList
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.summary}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{active}</Text>
                <Text style={styles.summaryLabel}>Active</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{lowStock}</Text>
                <Text style={styles.summaryLabel}>Low stock</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>
                  ₹{Math.round(inventoryValue).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.summaryLabel}>Inventory value</Text>
              </View>
            </View>

            <View style={styles.filters}>
              {FILTERS.map((item) => (
                <Chip
                  key={item}
                  label={item === 'LOW_STOCK' ? 'Low stock' : item.charAt(0) + item.slice(1).toLowerCase()}
                  selected={filter === item}
                  onPress={() => setFilter(item)}
                />
              ))}
            </View>

            <Button
              title="Add listing"
              variant="secondary"
              onPress={() => router.push('/listings/create')}
              style={styles.addButton}
            />
            <View style={styles.listSpacer} />

            {isLoading
              ? [0, 1, 2].map((i) => (
                  <Card key={i} style={styles.skeletonCard}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
                  </Card>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              title={parts.length === 0 ? 'No listings yet' : 'Nothing in this filter'}
              message={
                parts.length === 0
                  ? 'Add your first spare part to start selling.'
                  : 'Try another filter.'
              }
              action={
                parts.length === 0 ? (
                  <Button
                    title="Add listing"
                    onPress={() => router.push('/listings/create')}
                  />
                ) : undefined
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardTop}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.thumb}
                  contentFit="cover"
                  accessibilityLabel={item.name}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Text style={styles.thumbText}>{item.name.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.partNumber} numberOfLines={1}>
                  {item.partNumber} · {item.condition}
                </Text>
                <View style={styles.badges}>
                  <Text style={styles.price}>
                    ₹{Number(item.price).toLocaleString('en-IN')}
                  </Text>
                  <StatusPill
                    label={item.isActive ? 'Live' : 'Hidden'}
                    tone={item.isActive ? 'success' : 'neutral'}
                  />
                </View>
              </View>
            </View>

            <View style={styles.stockRow}>
              <Text
                style={[
                  styles.stock,
                  stockOf(item) === 0 && styles.stockOut,
                  stockOf(item) > 0 && stockOf(item) <= 3 && styles.stockLow,
                ]}
              >
                {stockLabel(item)}
              </Text>
              <View style={styles.stepper}>
                <Button
                  title="−"
                  variant="secondary"
                  disabled={stockOf(item) <= 0 || updatePart.isPending}
                  onPress={() => void setStock(item, stockOf(item) - 1)}
                  style={styles.stepButton}
                />
                <Button
                  title="+"
                  variant="secondary"
                  disabled={updatePart.isPending}
                  onPress={() => void setStock(item, stockOf(item) + 1)}
                  style={styles.stepButton}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Edit"
                variant="secondary"
                onPress={() => router.push(`/listings/${item.id}`)}
              />
              <Button
                title={item.isActive ? 'Hide' : 'Publish'}
                variant="secondary"
                loading={updatePart.isPending}
                onPress={() => void toggleActive(item)}
              />
              <Button
                title="Delete"
                variant="destructive"
                onPress={() =>
                  Alert.alert('Delete listing', `Remove ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void remove(item) },
                  ])
                }
              />
            </View>
            <Text style={styles.updated}>Updated {formatDate(item.createdAt)}</Text>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  summary: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    marginBottom: spacing.md,
  },
  summaryBlock: { flex: 1, gap: 2 },
  summaryValue: {
    fontFamily: fontFamilyMono,
    fontSize: 16,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: { ...typography.label, color: palette.textMuted },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listSpacer: { height: spacing.md },
  skeletonCard: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md, gap: spacing.md },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: palette.surfaceAlt,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbText: { ...typography.title, color: palette.textMuted },
  info: { flex: 1, gap: 2 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  partNumber: { ...typography.label, color: palette.textMuted },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  price: { ...typography.bodyMedium, color: palette.textPrimary },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  stock: { ...typography.caption, color: palette.textSecondary },
  stockLow: { color: palette.warning },
  stockOut: { color: palette.danger },
  stepper: { flexDirection: 'row', gap: spacing.sm },
  stepButton: { minWidth: 36, minHeight: 36, paddingHorizontal: 0 },
  addButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  updated: { ...typography.label, color: palette.textMuted },
});
