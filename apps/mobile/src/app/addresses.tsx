import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAddresses, useReplaceAddresses } from '@/hooks/useProfile';
import {
  Input,
  Button,
  ScreenContainer,
  AppHeader,
  Card,
  EmptyState,
  Skeleton,
  BackButton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

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
      <ScreenContainer>
        <AppHeader left={<BackButton />} title="Saved Addresses" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
            <Skeleton width="60%" height={12} style={{ marginTop: spacing.xs }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer>
        <AppHeader left={<BackButton />} title="Saved Addresses" subtitle="Manage your delivery and service addresses" />

        <Card style={styles.addCard}>
          <Text style={styles.addTitle}>Add New Address</Text>
          <Input
            label="Title"
            placeholder="Title (e.g. Home)"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <Input
            label="Street address"
            placeholder="Street address"
            value={newAddress}
            onChangeText={setNewAddress}
          />
          <View style={styles.coordsRow}>
            <View style={styles.coord}>
              <Input
                label="Latitude"
                placeholder="Latitude"
                value={newLat}
                onChangeText={setNewLat}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.coord}>
              <Input
                label="Longitude"
                placeholder="Longitude"
                value={newLng}
                onChangeText={setNewLng}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Button title="Add Address" onPress={handleAddAddress} disabled={saving} loading={saving} />
        </Card>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Your Addresses</Text>
        </View>

        {addresses.length === 0 ? (
          <EmptyState title="No saved addresses" message="Your saved addresses will appear here." />
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id ?? item.title}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <AddressItem item={item} onRemove={handleRemoveAddress} />
            )}
          />
        )}
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function AddressItem({ item, onRemove }: { item: Address; onRemove: (id: string) => void }) {
  return (
    <TouchableOpacity
      style={styles.itemTouch}
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={`Address ${item.title}`}
    >
      <Card style={styles.item}>
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
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  skeletonCard: { marginBottom: spacing.md },
  addCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  addTitle: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  coord: { flex: 1 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  listTitle: { ...typography.heading, color: palette.textPrimary },
  list: { paddingBottom: spacing.xxl },
  itemTouch: { marginBottom: spacing.md },
  item: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  itemAddress: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  itemCoords: { ...typography.label, color: palette.textMuted, marginTop: spacing.xs },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: palette.dangerSoftBg,
    backgroundColor: palette.dangerSoftBg,
  },
  removeText: { ...typography.label, color: palette.danger },
});
