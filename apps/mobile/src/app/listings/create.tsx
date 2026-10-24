import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateSparePart } from '@/hooks/useParts';
import {
  Input,
  Button,
  Chip,
  ScreenContainer,
  AppHeader,
  Skeleton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const CONDITIONS = ['OEM', 'AFTERMARKET', 'USED'];

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function CreateListingScreen() {
  const [form, setForm] = useState<{
    name: string;
    partNumber: string;
    compatibleMakes: string;
    compatibleModels: string;
    condition: string;
    price: string;
    stockQuantity: string;
    imageUrl: string;
    description: string;
  }>({
    name: '',
    partNumber: '',
    compatibleMakes: '',
    compatibleModels: '',
    condition: 'AFTERMARKET',
    price: '',
    stockQuantity: '1',
    imageUrl: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const createPart = useCreateSparePart();
  const router = useRouter();

  const handleSubmit = async () => {
    const { name, partNumber, compatibleMakes, compatibleModels, condition, price, stockQuantity, imageUrl, description } = form;
    if (!name || !partNumber || !price || !stockQuantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await createPart.mutateAsync({
        name,
        partNumber,
        compatibleMakes: compatibleMakes.split(',').map((s) => s.trim()).filter(Boolean),
        compatibleModels: compatibleModels.split(',').map((s) => s.trim()).filter(Boolean),
        condition: condition as any,
        price: parseFloat(price),
        stockQuantity: parseInt(stockQuantity, 10),
        imageUrl: imageUrl || undefined,
        description: description || undefined,
      });
      Alert.alert('Success', 'Part listed successfully');
      router.replace('/my-listings');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>List a Part</Text>
          <Text style={styles.subtitle}>Add a new spare part to your inventory</Text>
        </View>

        <View>
          <Input
            label="Part name"
            placeholder="e.g. Brake Pad Set"
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />
          <Input
            label="Part number"
            placeholder="e.g. BP-001"
            value={form.partNumber}
            onChangeText={(t) => setForm({ ...form, partNumber: t })}
            autoCapitalize="characters"
          />
          <Input
            label="Compatible makes (comma-separated)"
            placeholder="e.g. Maruti, Hyundai"
            value={form.compatibleMakes}
            onChangeText={(t) => setForm({ ...form, compatibleMakes: t })}
          />
          <Input
            label="Compatible models (comma-separated)"
            placeholder="e.g. Swift, i20"
            value={form.compatibleModels}
            onChangeText={(t) => setForm({ ...form, compatibleModels: t })}
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
            placeholder="0"
            value={form.price}
            onChangeText={(t) => setForm({ ...form, price: t })}
            keyboardType="numeric"
          />
          <Input
            label="Stock quantity"
            placeholder="1"
            value={form.stockQuantity}
            onChangeText={(t) => setForm({ ...form, stockQuantity: t })}
            keyboardType="numeric"
          />
          <Input
            label="Image URL (optional)"
            placeholder="https://example.com/image.jpg"
            value={form.imageUrl}
            onChangeText={(t) => setForm({ ...form, imageUrl: t })}
          />
          <Input
            label="Description (optional)"
            placeholder="Describe the part"
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
            style={styles.textarea}
          />
        </View>

        <Button title="List Part" onPress={handleSubmit} disabled={submitting} loading={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary, marginTop: spacing.xs },
  label: { ...typography.captionMedium, color: palette.textSecondary, marginBottom: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
});
