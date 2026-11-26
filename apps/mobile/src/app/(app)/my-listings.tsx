import { useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Minus, MoreHorizontal, Package, Plus } from 'lucide-react-native';
import { useMyParts, useDeleteSparePart, useUpdateSparePart, type SparePart } from '@/hooks/useParts';
import { Button, Chip, EmptyState, PageHeader, PressableScale, ScreenContainer, Skeleton, StatusPill } from '@/components/ui';
import { palette, radii, spacing, typography } from '@/theme';
import { labelize, formatRupees as money } from '@/utils/format';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Live' },
  { key: 'INACTIVE', label: 'Hidden' },
  { key: 'LOW_STOCK', label: 'Low stock' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const stockOf = (part: SparePart) => part.stockQuantity ?? 0;
const isLow = (part: SparePart) => stockOf(part) <= 3;

function stockLabel(part: SparePart) {
  if (stockOf(part) <= 0) return 'Out of stock';
  if (isLow(part)) return `Low stock: ${stockOf(part)}`;
  return `${stockOf(part)} in stock`;
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch } = useMyParts({ limit: 50 });
  const updatePart = useUpdateSparePart();
  const deletePart = useDeleteSparePart();
  const [filter, setFilter] = useState<Filter>('ALL');
  /** Row whose ⋯ menu is open, and whether it's asking to confirm Delete. */
  const [menu, setMenu] = useState<{ id: string; confirm: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const parts = data?.items ?? [];
  const counts: Record<Filter, number> = {
    ALL: parts.length,
    ACTIVE: parts.filter((p) => p.isActive).length,
    INACTIVE: parts.filter((p) => !p.isActive).length,
    LOW_STOCK: parts.filter(isLow).length,
  };
  const visible = parts.filter((part) => {
    if (filter === 'ACTIVE') return part.isActive;
    if (filter === 'INACTIVE') return !part.isActive;
    if (filter === 'LOW_STOCK') return isLow(part);
    return true;
  });
  const stockValue = parts
    .filter((part) => part.isActive)
    .reduce((sum, part) => sum + Number(part.price) * stockOf(part), 0);

  const run = async (part: SparePart, action: () => Promise<unknown>, failure: string) => {
    setBusyId(part.id);
    try {
      await action();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || failure);
    } finally {
      setBusyId(null);
    }
  };

  // Sends the change, not a total: a sale settling while the dealer looks at
  // the screen must not be overwritten (the server adds to the current stock).
  const changeStock = (part: SparePart, delta: 1 | -1) =>
    delta < 0 && stockOf(part) <= 0
      ? undefined
      : run(part, () => updatePart.mutateAsync({ id: part.id, stockDelta: delta }), 'Could not update stock.');

  const toggleActive = (part: SparePart) => {
    setMenu(null);
    void run(part, () => updatePart.mutateAsync({ id: part.id, isActive: !part.isActive }), 'Could not update listing.');
  };

  const remove = (part: SparePart) => {
    setMenu(null);
    void run(
      part,
      async () => {
        await deletePart.mutateAsync(part.id);
        await refetch();
      },
      'Could not delete listing.',
    );
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Listings"
              subtitle={
                parts.length === 0
                  ? 'Parts you sell in the shop'
                  : `${counts.ACTIVE} live, ${counts.LOW_STOCK} low on stock, ${money(stockValue)} in stock`
              }
              action={{ label: 'Add', onPress: () => router.push('/listings/create'), accessibilityLabel: 'Add listing' }}
            />
            {parts.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                {FILTERS.map((f) => (
                  <Chip
                    key={f.key}
                    label={`${f.label} ${counts[f.key]}`}
                    accessibilityLabel={`${f.label}, ${counts[f.key]} listings`}
                    selected={filter === f.key}
                    onPress={() => setFilter(f.key)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <Skeleton width={64} height={64} />
                    <View style={styles.info}>
                      <Skeleton width="70%" height={16} />
                      <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
                    </View>
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              title={parts.length === 0 ? 'No listings yet' : 'Nothing in this filter'}
              message={parts.length === 0 ? 'Add your first spare part to start selling.' : 'Try another filter.'}
              action={
                parts.length === 0 ? <Button title="Add listing" onPress={() => router.push('/listings/create')} /> : undefined
              }
            />
          )
        }
        renderItem={({ item, index }) => {
          const busy = busyId === item.id;
          const open = menu?.id === item.id;
          return (
            <View style={[styles.item, index > 0 && styles.divider]}>
              <View style={styles.row}>
                <PressableScale
                  onPress={() => router.push(`/listings/${item.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}, ${money(Number(item.price))}, ${stockLabel(item)}`}
                  scaleTo={0.99}
                  style={styles.main}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Package size={24} color={palette.textMuted} strokeWidth={1.7} />
                    </View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.partNumber}, {item.condition === 'OEM' ? 'OEM' : labelize(item.condition)}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{money(Number(item.price))}</Text>
                      <StatusPill label={item.isActive ? 'Live' : 'Hidden'} tone={item.isActive ? 'success' : 'neutral'} />
                    </View>
                  </View>
                </PressableScale>
                <PressableScale
                  onPress={() => setMenu(open ? null : { id: item.id, confirm: false })}
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${item.name}`}
                  accessibilityState={{ expanded: open }}
                  scaleTo={0.9}
                  style={styles.more}
                >
                  <MoreHorizontal size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </PressableScale>
              </View>

              <View style={styles.stockRow}>
                <Text style={[styles.stock, stockOf(item) === 0 ? styles.stockOut : isLow(item) && styles.stockLow]}>
                  {stockLabel(item)}
                </Text>
                <View style={styles.stepper}>
                  <PressableScale
                    onPress={() => void changeStock(item, -1)}
                    disabled={busy || stockOf(item) <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={`One less ${item.name} in stock`}
                    scaleTo={0.9}
                    style={[styles.step, (busy || stockOf(item) <= 0) && styles.stepDisabled]}
                  >
                    <Minus size={18} color={palette.textPrimary} strokeWidth={2} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => void changeStock(item, 1)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`One more ${item.name} in stock`}
                    scaleTo={0.9}
                    style={[styles.step, busy && styles.stepDisabled]}
                  >
                    <Plus size={18} color={palette.textPrimary} strokeWidth={2} />
                  </PressableScale>
                </View>
              </View>

              {open ? (
                menu.confirm ? (
                  <View style={styles.menu}>
                    <Text style={styles.confirmText}>Delete {item.name}? This can&apos;t be undone.</Text>
                    <View style={styles.menuButtons}>
                      <Button title="Cancel" variant="secondary" onPress={() => setMenu(null)} />
                      <Button title="Delete" variant="destructive" onPress={() => remove(item)} />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.menu, styles.menuButtons]}>
                    <Button
                      title={item.isActive ? 'Hide from shop' : 'Show in shop'}
                      variant="secondary"
                      onPress={() => toggleActive(item)}
                    />
                    <Button
                      title="Delete"
                      variant="destructive"
                      onPress={() => setMenu({ id: item.id, confirm: true })}
                    />
                  </View>
                )
              ) : null}
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  item: { paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  main: { flex: 1, flexDirection: 'row', gap: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  price: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginLeft: 64 + spacing.md,
  },
  stock: { ...typography.caption, color: palette.textSecondary },
  stockLow: { color: palette.warning },
  stockOut: { color: palette.danger },
  stepper: { flexDirection: 'row', gap: spacing.sm },
  step: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  stepDisabled: { opacity: 0.4 },
  menu: { marginTop: spacing.md, marginLeft: 64 + spacing.md },
  menuButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirmText: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.sm },
});
