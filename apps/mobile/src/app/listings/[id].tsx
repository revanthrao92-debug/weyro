import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSparePart, useUpdateSparePart, useDeleteSparePart } from '@/hooks/useParts';
import {
  Input,
  Button,
  Chip,
  Card,
  EmptyState,
  ScreenContainer,
  AppHeader,
  Skeleton,
  BackButton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

type ListingParams = { id: string };

const CONDITIONS = ['OEM', 'AFTERMARKET', 'USED'];

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<ListingParams>();
  const { data: part, isLoading } = useSparePart(id || '');
  const updatePart = useUpdateSparePart();
  const deletePart = useDeleteSparePart();
  const router = useRouter();

  const [form, setForm] = useState<{
    name: string;
    partNumber: string;
    condition: string;
    price: string;
    stockQuantity: string;
    description: string;
    isActive: boolean;
  }>({
    name: '',
    partNumber: '',
    condition: 'AFTERMARKET',
    price: '',
    stockQuantity: '',
    description: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader left={<BackButton />} title="Edit Listing" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton width="50%" height={14} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScreenContainer>
    );
  }

  if (!part) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader left={<BackButton />} title="Edit Listing" />
        <EmptyState title="Part not found" message="This part may have been removed." />
      </ScreenContainer>
    );
  }

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await updatePart.mutateAsync({
        id: part.id,
        name: form.name || undefined,
        partNumber: form.partNumber || undefined,
        condition: form.condition as any,
        price: form.price ? parseFloat(form.price) : undefined,
        stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity, 10) : undefined,
        description: form.description || undefined,
        isActive: form.isActive,
      });
      Alert.alert('Success', 'Listing updated');
      router.replace('/my-listings');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to update listing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
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
      await deletePart.mutateAsync(part.id);
      Alert.alert('Success', 'Listing deleted');
      router.replace('/my-listings');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to delete listing');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader left={<BackButton />} title="Edit Listing" subtitle="Update part details" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View>
            <Input
              label="Part name"
              placeholder="Part name"
              value={form.name || part.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
            />
            <Input
              label="Part number"
              placeholder="Part number"
              value={form.partNumber || part.partNumber}
              onChangeText={(t) => setForm({ ...form, partNumber: t })}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Condition</Text>
            <View style={styles.chipWrap}>
              {CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  label={labelize(c)}
                  selected={form.condition === c}
                  onPress={() => setForm({ ...form, condition: c })}
                />
              ))}
            </View>

            <Input
              label="Price (₹)"
              placeholder="Price"
              value={form.price || part.price.toString()}
              onChangeText={(t) => setForm({ ...form, price: t })}
              keyboardType="numeric"
            />
            <Input
              label="Stock quantity"
              placeholder="Quantity"
              value={form.stockQuantity || part.stockQuantity.toString()}
              onChangeText={(t) => setForm({ ...form, stockQuantity: t })}
              keyboardType="numeric"
            />
            <Input
              label="Description"
              placeholder="Description"
              value={form.description || part.description || ''}
              onChangeText={(t) => setForm({ ...form, description: t })}
              multiline
              style={styles.textarea}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Active</Text>
              <TouchableOpacity
                style={[styles.toggle, form.isActive && styles.toggleActive]}
                onPress={() => setForm({ ...form, isActive: !form.isActive })}
                accessibilityRole="switch"
                accessibilityState={{ checked: form.isActive }}
                accessibilityLabel="Active"
              >
                <Text style={[styles.toggleText, form.isActive && styles.toggleTextActive]}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button title="Save Changes" onPress={handleSave} disabled={submitting} loading={submitting} />
          <Button title="Delete Listing" variant="destructive" onPress={handleDelete} style={styles.deleteBtn} />
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  label: { ...typography.captionMedium, color: palette.textSecondary, marginBottom: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: palette.textPrimary, flex: 1, marginRight: spacing.md },
  toggle: {
    minWidth: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  toggleText: { ...typography.label, color: palette.textSecondary },
  toggleTextActive: { color: palette.accent },
  deleteBtn: { marginTop: spacing.md, alignSelf: 'flex-start' },
});
