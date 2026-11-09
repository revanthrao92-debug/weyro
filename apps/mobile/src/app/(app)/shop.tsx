import { useState } from 'react';
import { FlatList, Text, View, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useParts } from '@/hooks/useParts';
import {
  Package,
  Wrench,
  Disc3,
  Settings2,
  Zap,
  Car,
  Filter,
} from 'lucide-react-native';
import { Input, ScreenContainer, Card, StatusPill, EmptyState, Skeleton, FilterBar, AdBanner } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';
import { Image } from 'expo-image';
import { photo, photoForCategory } from '@/lib/photos';

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
  const { data, isLoading } = useParts({ search, make });

  const parts = data?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Spare parts</Text>
          <Text style={styles.title}>Find the right part</Text>
        </View>
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
    <ScreenContainer chrome="dark">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Spare parts</Text>
        <Text style={styles.title}>Find the right part</Text>
        <Text style={styles.subtitle}>Genuine parts from verified dealers.</Text>
      </View>

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
          ListFooterComponent={
            <View style={{ marginTop: spacing.md }}>
              <AdBanner placement="shop-section" />
            </View>
          }
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
        <Image
          source={{ uri: part.imageUrl || photo(photoForCategory(part.category)) }}
          style={styles.partPhoto}
          contentFit="cover"
          transition={120}
        />
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
  header: { marginBottom: spacing.lg },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { ...typography.display, color: palette.textPrimary, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: palette.textSecondary, marginTop: spacing.xs },
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
    flexBasis: '31%',
    flexGrow: 1,
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
    backgroundColor: palette.accentSoftBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.accent,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rareTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  rareSub: {
    ...typography.caption,
    color: palette.textSecondary,
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
    borderColor: palette.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: { flex: 1, marginRight: spacing.md, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  partPhoto: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  info: { flex: 1 },
  partName: { ...typography.bodyMedium, color: palette.textPrimary, marginBottom: spacing.xs },
  partNumber: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.xs },
  priceStock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  price: { ...typography.bodyMedium, fontSize: 18, color: palette.textPrimary },
});
