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
import { useRouter } from 'expo-router';
import { useCreateSparePart } from '@/hooks/useParts';
import { Input } from '@/components/ui/Input';

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
      router.replace('/listings');
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>List a Part</Text>
          <Text style={styles.subtitle}>Add a new spare part to your inventory</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Part Name</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Brake Pad Set"
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />

          <Text style={styles.label}>Part Number</Text>
          <Input
            style={styles.input}
            placeholder="e.g. BP-001"
            value={form.partNumber}
            onChangeText={(t) => setForm({ ...form, partNumber: t })}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Compatible Makes (comma-separated)</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Maruti, Hyundai"
            value={form.compatibleMakes}
            onChangeText={(t) => setForm({ ...form, compatibleMakes: t })}
          />

          <Text style={styles.label}>Compatible Models (comma-separated)</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Swift, i20"
            value={form.compatibleModels}
            onChangeText={(t) => setForm({ ...form, compatibleModels: t })}
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
            placeholder="0"
            value={form.price}
            onChangeText={(t) => setForm({ ...form, price: t })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Stock Quantity</Text>
          <Input
            style={styles.input}
            placeholder="1"
            value={form.stockQuantity}
            onChangeText={(t) => setForm({ ...form, stockQuantity: t })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Image URL (optional)</Text>
          <Input
            style={styles.input}
            placeholder="https://example.com/image.jpg"
            value={form.imageUrl}
            onChangeText={(t) => setForm({ ...form, imageUrl: t })}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <Input
            style={styles.input}
            placeholder="Describe the part"
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>List Part</Text>
          )}
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
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
} as any;
