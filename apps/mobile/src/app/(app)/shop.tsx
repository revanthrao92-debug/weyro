import { useState } from 'react';
import { FlatList, Text, View, ActivityIndicator, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useParts } from '@/hooks/useParts';
import {
  EllipsisVertical,
  Package,
  Wrench,
  Disc3,
  Settings2,
  Zap,
  Car,
  Filter,
  ArrowUpFromLine,
} from 'lucide-react-native';
import { Input, IconButton, ScreenContainer, AppHeader, Card, Avatar, StatusPill, EmptyState, Skeleton, FilterBar } from '@/components/ui';
import { palette, spacing, radii, typography, elevation } from '@/theme';

const CATEGORIES = [
  { label: 'Engine', Icon: Wrench },
  { label: 'Brakes', Icon: Disc3 },
  { label: 'Suspension', Icon: Settings2 },
  { label: 'Electrical', Icon: Zap },
  { label: 'Body Parts', Icon: Car },
  { label: 'Filters', Icon: Filter },
];

export default function ShopScreen() {
  const [search, setSearch] = useState('');
  const [make, setMake] = useState('');
  const router = useRouter();
  const { data, isLoading, refetch } = useParts({ search, make });

  const parts = data?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader title="Spare Parts" subtitle="Genuine parts & accessories" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="100%" height={22} />
            <Skeleton width="60%" height={14} style={{ marginTop: spacing.sm }} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title="Spare Parts" subtitle="Genuine parts & accessories" />

      {/* Category tiles */}
      <View style={styles.catGrid}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.label}
            onPress={() => router.push(`/requests/create?category=SPARE_PART`)}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            className="active:opacity-70"
            style={styles.catTile}
          >
            <View style={styles.catIconWrap}>
              <c.Icon size={22} color={palette.teal} strokeWidth={1.75} />
            </View>
            <Text style={styles.catLabel} maxFontSizeMultiplier={2}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Rare-part request banner */}
      <Pressable
        onPress={() => router.push('/requests/create?category=SPARE_PART')}
        accessibilityRole="button"
        accessibilityLabel="Can't find what you need? Upload a photo"
        className="active:opacity-90"
        style={styles.rareBanner}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rareTitle} maxFontSizeMultiplier={2}>Can&apos;t find what you need?</Text>
          <Text style={styles.rareSub} maxFontSizeMultiplier={2}>
            Upload a photo and let dealers find it for you.
          </Text>
          <View style={styles.rareCta}>
            <Text style={styles.rareCtaText}>Upload Photo</Text>
          </View>
        </View>
      </Pressable>

      <FilterBar>
        <View style={styles.filterBar}>
        <Input
          label="Search"
          placeholder="Search parts..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="words"
          containerStyle={styles.filterField}
        />
        <Input
          label="Make"
          placeholder="Make (e.g. Maruti)"
          value={make}
          onChangeText={setMake}
          autoCapitalize="characters"
          containerStyle={styles.filterField}
        />
        <IconButton
          icon={<EllipsisVertical size={20} color={palette.textPrimary} strokeWidth={2} />}
          onPress={() => refetch()}
          accessibilityLabel="Filter parts"
        />
        </View>
      </FilterBar>

      {parts.length === 0 ? (
        <EmptyState
          icon={<Package size={28} color={palette.textMuted} />}
          title="No parts found"
          message="Adjust your search or filters."
        />
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PartCard part={item} onPress={() => router.push(`/shop/${item.id}`)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function PartCard({ part, onPress }: { part: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Part ${part.name}, ₹${part.price.toLocaleString()}`}
    >
      <View style={styles.cardContent}>
        <Avatar name={part.name} size={56} uri={part.imageUrl} />
        <View style={styles.info}>
          <Text style={styles.partName}>{part.name}</Text>
          <Text style={styles.partNumber}>{part.partNumber}</Text>
          <StatusPill
            label={part.condition.charAt(0).toUpperCase() + part.condition.slice(1)}
            tone="neutral"
          />
        </View>
        <View style={styles.priceStock}>
          <Text style={styles.price}>₹{part.price.toLocaleString()}</Text>
          <StockBadge stock={part.stockQuantity} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StockBadge({ stock }: { stock: number }) {
  const tone = stock > 0 ? 'success' : 'danger';
  const label = stock > 0 ? `In Stock (${stock})` : 'Out of Stock';
  return <StatusPill label={label} tone={tone} />;
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    // Bottom-align: the labelled inputs are taller than the square icon
    // button; flex-end keeps the ⋮ button on the field line, not the labels.
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  filterField: { flex: 1, marginBottom: 0 },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  catTile: {
    width: (375 - 32 - 12) / 3,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  catLabel: {
    ...typography.label,
    color: palette.textSecondary,
  },
  rareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.header,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rareTitle: {
    ...typography.bodyMedium,
    color: palette.onHeader,
  },
  rareSub: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  rareCta: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rareCtaText: {
    ...typography.label,
    color: palette.onAccent,
    fontWeight: '600',
  },
  list: { paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    ...elevation.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: { flex: 1, marginRight: spacing.md },
  info: { flex: 1 },
  partName: { ...typography.bodyMedium, color: palette.textPrimary, marginBottom: spacing.xs },
  partNumber: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.xs },
  priceStock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  price: { ...typography.bodyMedium, fontSize: 18, color: palette.textPrimary },
});
