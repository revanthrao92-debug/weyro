import {
  FlatList,
  Text,
  View,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMyParts, useDeleteSparePart , SparePart } from '@/hooks/useParts';
import {
  Button,
  ScreenContainer,
  AppHeader,
  Card,
  StatusPill,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { palette, spacing, radii, typography, elevation } from '@/theme';

export default function MyListingsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch } = useMyParts();
  const deletePart = useDeleteSparePart();

  const parts = data?.items ?? [];

  const handleDelete = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete Listing',
        'Are you sure you want to delete this part?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;
    try {
      await deletePart.mutateAsync(id);
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to delete listing');
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark">
        <AppHeader title="My Listings" subtitle="Manage your spare parts inventory" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="100%" height={18} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="My Listings" subtitle="Manage your spare parts inventory" />

      {parts.length === 0 ? (
        <EmptyState
          title="No listings yet"
          message="List a spare part to start selling."
          action={<Button title="Add part" onPress={() => router.push('/listings/create')} />}
        />
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: SparePart }) => (
            <ListingItem item={item} onDelete={handleDelete} onEdit={() => router.push(`/listings/${item.id}`)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function ListingItem({ item, onDelete, onEdit }: { item: SparePart; onDelete: (id: string) => void; onEdit: () => void }) {
  return (
    <TouchableOpacity
      style={styles.itemTouch}
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={`Listing ${item.name}`}
    >
      <Card style={styles.item}>
        <View style={styles.info}>
          <Text style={styles.partName}>{item.name}</Text>
          <Text style={styles.partNumber}>{item.partNumber}</Text>
          <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
          <Text style={styles.stock}>{item.stockQuantity} in stock</Text>
          <StatusPill
            label={item.isActive ? 'Active' : 'Inactive'}
            tone={item.isActive ? 'success' : 'neutral'}
          />
        </View>
        <View style={styles.actions}>
          <Button title="Edit" variant="secondary" onPress={onEdit} style={styles.editBtn} />
          <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)} accessibilityLabel={`Delete ${item.name}`}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  itemTouch: { marginBottom: spacing.md },
  item: {
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
  info: { flex: 1 },
  partName: { ...typography.bodyMedium, color: palette.textPrimary },
  partNumber: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  price: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: spacing.xs },
  stock: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  editBtn: { minWidth: 88 },
  deleteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: palette.dangerSoftBg,
    backgroundColor: palette.dangerSoftBg,
  },
  deleteText: { ...typography.label, color: palette.danger },
});
