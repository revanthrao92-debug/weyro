import { useState } from 'react';
import { FlatList, Text, View, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useParts } from '@/hooks/useParts';
import { EllipsisVertical, Package } from 'lucide-react-native';
import { Input, IconButton, ScreenContainer, AppHeader, Card, Avatar, StatusPill, EmptyState, Skeleton, FilterBar } from '@/components/ui';
import { palette, spacing, radii, typography, elevation } from '@/theme';

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
