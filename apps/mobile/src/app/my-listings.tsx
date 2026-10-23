import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMyParts, useDeleteSparePart } from '@/hooks/useParts';
import { SparePart } from '@/hooks/useParts';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Listings</Text>
        <Text style={styles.subtitle}>Manage your spare parts inventory</Text>
      </View>

      {parts.length === 0 ? (
        <View style={styles.empty}>
          <Text>No listings yet</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/listings/create')}>
            <Text style={styles.emptyButtonText}>Add your first part</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: SparePart }) => (
            <ListingItem item={item} onDelete={handleDelete} onEdit={() => router.push(`/listings/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

function ListingItem({ item, onDelete, onEdit }: { item: SparePart; onDelete: (id: string) => void; onEdit: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.partName}>{item.name}</Text>
        <Text style={styles.partNumber}>{item.partNumber}</Text>
        <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
        <Text style={styles.stock}>
          {item.stockQuantity} in stock
        </Text>
        <Text style={[styles.status, { color: item.isActive ? '#10B981' : '#6B7280' }]}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1 },
  partName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  partNumber: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  stock: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#208AEF',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#208AEF',
    backgroundColor: '#FFFFFF',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#208AEF',
  },
} as any;

