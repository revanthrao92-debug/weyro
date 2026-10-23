import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSparePart, useUpdateSparePart, useDeleteSparePart } from '@/hooks/useParts';
import { Input } from '@/components/ui/Input';

type ListingParams = { id: string };

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!part) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>Part not found</Text>
      </View>
    );
  }

  // Initialize form from part data
  // (using useEffect would be cleaner but keeping it simple)
  
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
      router.replace('/listings');
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
      router.replace('/listings');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to delete listing');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit Listing</Text>
          <Text style={styles.subtitle}>Update part details</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Part Name</Text>
          <Input
            style={styles.input}
            placeholder="Part name"
            value={form.name || part.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />

          <Text style={styles.label}>Part Number</Text>
          <Input
            style={styles.input}
            placeholder="Part number"
            value={form.partNumber || part.partNumber}
            onChangeText={(t) => setForm({ ...form, partNumber: t })}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Condition</Text>
          <View style={styles.conditionSelector}>
            {['OEM', 'AFTERMARKET', 'USED'].map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.conditionOption,
                  form.condition === c && styles.conditionOptionSelected,
                ]}
                onPress={() => setForm({ ...form, condition: c })}
              >
                <Text style={styles.conditionText}>
                  {c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Price (₹)</Text>
          <Input
            style={styles.input}
            placeholder="Price"
            value={form.price || part.price.toString()}
            onChangeText={(t) => setForm({ ...form, price: t })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Stock Quantity</Text>
          <Input
            style={styles.input}
            placeholder="Quantity"
            value={form.stockQuantity || part.stockQuantity.toString()}
            onChangeText={(t) => setForm({ ...form, stockQuantity: t })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Description</Text>
          <Input
            style={styles.input}
            placeholder="Description"
            value={form.description || part.description || ''}
            onChangeText={(t) => setForm({ ...form, description: t })}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Active</Text>
            <TouchableOpacity
              style={[styles.toggle, form.isActive && styles.toggleActive]}
              onPress={() => setForm({ ...form, isActive: !form.isActive })}
            >
              <Text style={[styles.toggleText, form.isActive && styles.toggleTextActive]}>
                {form.isActive ? 'Active' : 'Inactive'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Listing</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, minHeight: '100%', gap: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  conditionSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  conditionOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  conditionOptionSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#EFF6FF',
  },
  conditionText: {
    fontSize: 14,
    color: '#374151',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    color: '#374151',
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  toggleActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#10B981',
  },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
} as any;
