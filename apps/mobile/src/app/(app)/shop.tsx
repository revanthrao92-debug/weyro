import { useEffect, useState } from 'react';
import { FlatList, Text, View, Pressable, StyleSheet } from 'react-native';
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
  ClipboardCheck,
} from 'lucide-react-native';
import { Input, ScreenContainer, Card, StatusPill, EmptyState, Skeleton, FilterBar, AdBanner, FadeSlideIn, PressableScale, ErrorState } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { Image } from 'expo-image';
import { useRefreshControl } from '@/hooks/useRefreshControl';

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
  // Search after typing pauses, not on every keystroke.
  const [query, setQuery] = useState({ search, make });
  useEffect(() => {
    const t = setTimeout(() => setQuery({ search: search.trim(), make: make.trim() }), 300);
    return () => clearTimeout(t);
  }, [search, make]);
  const { data, isLoading, isError, refetch } = useParts(query);
  const refreshControl = useRefreshControl(refetch);

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
              <c.Icon size={20} color={palette.textSecondary} strokeWidth={1.7} />
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
            <Text style={styles.rareCtaText}>Upload photo</Text>
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

      {isError && !data ? (
        <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
      ) : parts.length === 0 ? (
        <EmptyState
          icon={<Package size={28} color={palette.textMuted} />}
          title="No parts found"
          message="Adjust your search or filters."
        />
      ) : (
        <FlatList
          refreshControl={refreshControl}
          data={parts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <View style={{ marginTop: spacing.md }}>
              <AdBanner placement="shop-section" />
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeSlideIn delay={Math.min(index, 6) * 50}>
              <PartCard part={item} onPress={() => router.push(`/shop/${item.id}`)} />
            </FadeSlideIn>
          )}
        />
      )}
    </ScreenContainer>
  );
}

function PartCard({ part, onPress }: { part: any; onPress: () => void }) {
  return (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Part ${part.name}, ₹${Number(part.price).toLocaleString("en-IN")}`}
      scaleTo={0.98}
    >
      <View style={styles.cardContent}>
        {part.imageUrl ? (
          <Image
            source={{ uri: part.imageUrl }}
            style={styles.partPhoto}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={[styles.partPhoto, styles.partPhotoEmpty]}>
            {part.kind === 'PACKAGE' ? (
              <ClipboardCheck size={24} color={palette.textMuted} strokeWidth={1.6} />
            ) : (
              <Package size={24} color={palette.textMuted} strokeWidth={1.6} />
            )}
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.partName}>{part.name}</Text>
          <Text style={styles.partNumber}>{part.partNumber}</Text>
          <StatusPill
            label={part.condition.charAt(0).toUpperCase() + part.condition.slice(1)}
            tone="neutral"
          />
        </View>
        <View style={styles.priceStock}>
          <Text style={styles.price}>₹{Number(part.price).toLocaleString('en-IN')}</Text>
          <StockBadge inStock={part.inStock ?? (part.stockQuantity ?? 0) > 0} />
        </View>
      </View>
    </PressableScale>
  );
}

function StockBadge({ inStock }: { inStock: boolean }) {
  const tone = inStock ? 'success' : 'danger';
  const label = inStock ? 'Available' : 'Out of stock';
  return <StatusPill label={label} tone={tone} />;
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.lg },
  eyebrow: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.3,
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
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  catIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  catLabel: {
    ...typography.label,
    color: palette.textSecondary,
  },
  rareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: palette.accent,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.accent,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  rareCtaText: {
    ...typography.label,
    color: palette.accent,
  },
  list: { paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: { flex: 1, marginRight: spacing.md, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  partPhoto: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: palette.surfaceAlt,
  },
  partPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  partName: { ...typography.bodyMedium, color: palette.textPrimary, marginBottom: spacing.xs },
  partNumber: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.xs },
  priceStock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  price: { ...typography.bodyMedium, fontSize: 18, color: palette.textPrimary },
});
