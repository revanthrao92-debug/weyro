import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAddresses, useReplaceAddresses, type SavedAddress } from '@/hooks/useProfile';
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
import { LocationField, LocationPicker, type PickedLocation } from '@/maps';
import { palette, spacing, radii, typography, fontFamilyMono } from '@/theme';

export default function AddressesScreen() {
  const { data, isLoading, refetch } = useAddresses();
  const replaceAddresses = useReplaceAddresses();
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [draft, setDraft] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const addresses = data?.addresses ?? [];

  const handleAddAddress = async () => {
    if (!newTitle.trim() || !draft) {
      Alert.alert('Missing details', 'Add a label and choose the address on the map.');
      return;
    }

    const updated: SavedAddress[] = [
      ...addresses,
      {
        id: `addr-${Date.now()}`,
        title: newTitle.trim(),
        address: draft.address,
        latitude: draft.latitude,
        longitude: draft.longitude,
      },
    ];

    setSaving(true);
    try {
      await replaceAddresses.mutateAsync(updated);
      setNewTitle('');
      setDraft(null);
      await refetch();
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
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Saved addresses" />
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
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader
          left={<BackButton />}
          title="Saved addresses"
          subtitle="Reused across service requests"
        />

        <Card style={styles.addCard}>
          <Text style={styles.addTitle}>Add address</Text>
          <Input
            label="Label"
            placeholder="e.g. Home, Office"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <LocationField
            label="Address"
            value={draft}
            placeholder="Choose on the map"
            onPress={() => setPickerOpen(true)}
          />
          <Button
            title="Save address"
            onPress={handleAddAddress}
            disabled={saving || !draft || !newTitle.trim()}
            loading={saving}
            style={styles.saveButton}
          />
        </Card>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Your addresses</Text>
          <Text style={styles.listCount}>{addresses.length}</Text>
        </View>

        {addresses.length === 0 ? (
          <EmptyState
            title="No saved addresses"
            message="Save a home or office address so requests take two taps."
          />
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

      <LocationPicker
        visible={pickerOpen}
        title="Add saved address"
        hint="Search or drag the pin"
        initial={draft}
        useSavedFallback={false}
        confirmLabel="Use this address"
        onClose={() => setPickerOpen(false)}
        onConfirm={(next) => {
          setDraft(next);
          setPickerOpen(false);
          if (!newTitle.trim() && next.label) setNewTitle(next.label);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function AddressItem({
  item,
  onRemove,
}: {
  item: SavedAddress;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemAddress} numberOfLines={2}>
          {item.address}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => item.id && onRemove(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.title}`}
      >
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  skeletonCard: { marginBottom: spacing.md },
  addCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  addTitle: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  saveButton: { marginTop: spacing.xs },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listTitle: { ...typography.heading, color: palette.textPrimary },
  listCount: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
  },
  list: { paddingBottom: spacing.xxl },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  itemContent: { flex: 1 },
  itemTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  itemAddress: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 3,
  },
  removeButton: { paddingVertical: 8, paddingHorizontal: 4 },
  removeText: { ...typography.label, color: palette.danger },
});
