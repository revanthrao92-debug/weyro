import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useAddresses, useReplaceAddresses } from '@/hooks/useProfile';
import { Input } from '@/components/ui/Input';

type Address = {
  id?: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
};

export default function AddressesScreen() {
  const { data, isLoading, refetch } = useAddresses();
const replaceAddresses = useReplaceAddresses();
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');

  const addresses = data?.addresses ?? [];

  const handleAddAddress = async () => {
    if (!newTitle || !newAddress || !newLat || !newLng) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const updated = [
      ...addresses,
      {
        id: `addr-${Date.now()}`,
        title: newTitle,
        address: newAddress,
        latitude: parseFloat(newLat),
        longitude: parseFloat(newLng),
      },
    ];

    setSaving(true);
    try {
      await replaceAddresses.mutateAsync(updated);
      setNewTitle('');
      setNewAddress('');
      setNewLat('');
      setNewLng('');
      await refetch();
      Alert.alert('Success', 'Address added');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to add address');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAddress = async (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    setSaving(true);
    try {
      await replaceAddresses.mutateAsync(updated);
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to remove address');
    } finally {
      setSaving(false);
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
        <Text style={styles.title}>Saved Addresses</Text>
        <Text style={styles.subtitle}>
          Manage your delivery and service addresses
        </Text>
      </View>

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add New Address</Text>
        <Input
          style={styles.input}
          placeholder="Title (e.g. Home)"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <Input
          style={styles.input}
          placeholder="Street address"
          value={newAddress}
          onChangeText={setNewAddress}
        />
        <View style={styles.coordsRow}>
          <Input
            style={styles.coordInput}
            placeholder="Latitude"
            value={newLat}
            onChangeText={setNewLat}
            keyboardType="numeric"
          />
          <Input
            style={styles.coordInput}
            placeholder="Longitude"
            value={newLng}
            onChangeText={setNewLng}
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddAddress} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.addButtonText}>Add Address</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Your Addresses</Text>
      </View>

      {addresses.length === 0 ? (
        <View style={styles.empty}>
          <Text>No saved addresses</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id ?? item.title}
          renderItem={({ item }) => (
            <AddressItem item={item} onRemove={handleRemoveAddress} />
          )}
        />
      )}
    </View>
  );
}

function AddressItem({ item, onRemove }: { item: Address; onRemove: (id: string) => void }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemAddress}>{item.address}</Text>
        <Text style={styles.itemCoords}>
          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
        </Text>
      </View>
      <TouchableOpacity style={styles.removeButton} onPress={() => onRemove(item.id!)}>
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
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
  addCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  coordInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    color: '#9CA3AF',
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itemAddress: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  itemCoords: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
} as any;
