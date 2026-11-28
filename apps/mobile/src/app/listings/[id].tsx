import { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMySparePart, useUpdateSparePart, useDeleteSparePart, type SparePart } from '@/hooks/useParts';
import { EXISTING_IMAGE_KEY, type UploadedImage } from '@/services/uploads';
import { PhotoPicker } from '@/components/requests/PhotoPicker';
import {
  Input,
  Button,
  Chip,
  Card,
  EmptyState,
  ScreenContainer,
  PageHeader,
  Skeleton,
  SwitchRow,
  ErrorState,
} from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { plainTitleize as labelize } from '@/utils/format';
import { isNotFound } from '@/services/api-client';
import { confirmAction, notice } from '@/lib/confirm';

type ListingParams = { id: string };

const CONDITIONS = ['OEM', 'AFTERMARKET', 'USED'];

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<ListingParams>();
  // The dealer's own copy: the public one hides exact stock (saving would have written 0) and hidden parts.
  const { data: part, isLoading, isError, error, refetch } = useMySparePart(id || '');

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <View style={styles.scrollContent}>
          <PageHeader back title="Edit listing" />
        </View>
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
        <View style={styles.scrollContent}>
          <PageHeader back title="Edit listing" />
        </View>
        {isError && !isNotFound(error) ? (
          <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
        ) : (
          <EmptyState title="Part not found" message="This part may have been removed." />
        )}
      </ScreenContainer>
    );
  }

  return <ListingForm part={part} />;
}

function ListingForm({ part }: { part: SparePart }) {
  const router = useRouter();
  const updatePart = useUpdateSparePart();
  const deletePart = useDeleteSparePart();
  const [form, setForm] = useState({
    name: part.name,
    partNumber: part.partNumber,
    condition: part.condition,
    price: String(part.price),
    stockQuantity: String(part.stockQuantity ?? 0),
    description: part.description ?? '',
    imageUrl: part.imageUrl ?? '',
    isActive: part.isActive,
  });
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>(
    part.imageUrl ? [{ url: part.imageUrl, key: EXISTING_IMAGE_KEY }] : [],
  );
  const [uploading, setUploading] = useState(false);

  // Opened from a link or notification there is no screen to go back to.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/my-listings'));

  const handleSave = async () => {
    if (uploading) return;
    setSubmitting(true);
    try {
      await updatePart.mutateAsync({
        id: part.id,
        name: form.name.trim() || undefined,
        partNumber: form.partNumber.trim() || undefined,
        condition: form.condition,
        price: form.price ? parseFloat(form.price) : undefined,
        stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity, 10) : undefined,
        description: form.description || undefined,
        // Only a newly uploaded photo is sent (as its key); unchanged = omitted.
        imageUrl: images[0] && images[0].key !== EXISTING_IMAGE_KEY ? images[0].key : undefined,
        isActive: form.isActive,
      });
      notice('Saved', 'Listing updated');
      leave();
    } catch (e: any) {
      notice('Failed', e.message || 'Unable to update listing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction('Delete Listing', 'Are you sure you want to delete this part?', 'Delete');
    if (!confirmed) return;
    try {
      await deletePart.mutateAsync(part.id);
      leave();
    } catch (e: any) {
      notice('Failed', e.message || 'Unable to delete listing');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <PageHeader back title="Edit listing" subtitle={part.name} />
          <View>
            <Input
              label="Part name"
              placeholder="Part name"
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
            />
            <Input
              label="Part number"
              placeholder="Part number"
              value={form.partNumber}
              onChangeText={(t) => setForm({ ...form, partNumber: t })}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Condition</Text>
            <View style={styles.chipWrap}>
              {CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  label={c === 'OEM' ? 'OEM' : labelize(c)}
                  selected={form.condition === c}
                  onPress={() => setForm({ ...form, condition: c })}
                />
              ))}
            </View>

            <Input
              label="Price (₹)"
              placeholder="Price"
              value={form.price}
              onChangeText={(t) => setForm({ ...form, price: t })}
              keyboardType="numeric"
            />
            <Input
              label="Stock quantity"
              placeholder="Quantity"
              value={form.stockQuantity}
              onChangeText={(t) => setForm({ ...form, stockQuantity: t })}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Part photo</Text>
            <PhotoPicker
              images={images}
              onChange={setImages}
              max={1}
              folder="spare-parts"
              onUploadingChange={setUploading}
              helper="A clear photo helps customers buy the right part."
            />
            <Input
              label="Description"
              placeholder="Description"
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
              multiline
              style={styles.textarea}
            />

            <SwitchRow
              title="Show in the shop"
              detail={form.isActive ? 'Customers can see and buy this part.' : 'Hidden: customers cannot see it.'}
              value={form.isActive}
              onToggle={() => setForm({ ...form, isActive: !form.isActive })}
            />
          </View>

          <Button title="Save changes" onPress={handleSave} disabled={submitting} loading={submitting} />
          <Button title="Delete listing" variant="destructive" onPress={handleDelete} style={styles.deleteBtn} />
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
  deleteBtn: { marginTop: spacing.md, alignSelf: 'flex-start' },
});
