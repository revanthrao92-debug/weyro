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
import { useCreateServiceRequest } from '@/hooks/useRequests';
import { Input } from '@/components/ui/Input';

export default function CreateRequestScreen() {
  const [form, setForm] = useState<{
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: string;
    category: string;
    title: string;
    description: string;
    address: string;
    latitude: string;
    longitude: string;
    urgency: string;
    mediaUrls: string[];
    damagePhotos: string[];
    isBroadcast: boolean;
  }>({
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    category: 'REPAIR',
    title: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    urgency: 'NORMAL',
    mediaUrls: [],
    damagePhotos: [],
    isBroadcast: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const createRequest = useCreateServiceRequest();
  const router = useRouter();

  const handleSubmit = async () => {
    const {
      vehicleMake,
      vehicleModel,
      vehicleYear,
      category,
      title,
      description,
      address,
      latitude,
      longitude,
      urgency,
      isBroadcast,
    } = form;
    if (!vehicleMake || !vehicleModel || !vehicleYear || !title || !description || !address || !latitude || !longitude) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        vehicleMake,
        vehicleModel,
        vehicleYear: parseInt(vehicleYear, 10),
        category: category as any,
        title,
        description,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        urgency: urgency as any,
        mediaUrls: [],
        damagePhotos: [],
        isBroadcast,
      });
      Alert.alert('Success', 'Service request created');
      router.replace('/requests/my');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to create request');
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
          <Text style={styles.title}>Report Damage</Text>
          <Text style={styles.subtitle}>Tell us about your vehicle issue</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Vehicle Make</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Maruti"
            value={form.vehicleMake}
            onChangeText={(t) => setForm({ ...form, vehicleMake: t })}
          />

          <Text style={styles.label}>Vehicle Model</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Swift"
            value={form.vehicleModel}
            onChangeText={(t) => setForm({ ...form, vehicleModel: t })}
          />

          <Text style={styles.label}>Year</Text>
          <Input
            style={styles.input}
            placeholder="e.g. 2021"
            value={form.vehicleYear}
            onChangeText={(t) => setForm({ ...form, vehicleYear: t })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categorySelector}>
            {['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'].map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.categoryOption,
                  form.category === c && styles.categoryOptionSelected,
                ]}
                onPress={() => setForm({ ...form, category: c })}
              >
                <Text style={styles.categoryText}>
                  {c.charAt(0).toUpperCase() + c.slice(1).toLowerCase().replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Title</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Front bumper repair"
            value={form.title}
            onChangeText={(t) => setForm({ ...form, title: t })}
          />

          <Text style={styles.label}>Description</Text>
          <Input
            style={styles.input}
            placeholder="Describe the issue..."
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
          />

          <Text style={styles.label}>Address</Text>
          <Input
            style={styles.input}
            placeholder="e.g. Indiranagar, Bengaluru"
            value={form.address}
            onChangeText={(t) => setForm({ ...form, address: t })}
          />

          <View style={styles.coordsRow}>
            <Input
              style={styles.coordInput}
              placeholder="Latitude"
              value={form.latitude}
              onChangeText={(t) => setForm({ ...form, latitude: t })}
              keyboardType="numeric"
            />
            <Input
              style={styles.coordInput}
              placeholder="Longitude"
              value={form.longitude}
              onChangeText={(t) => setForm({ ...form, longitude: t })}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Urgency</Text>
          <View style={styles.urgencySelector}>
            {['NORMAL', 'URGENT', 'EMERGENCY'].map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.urgencyOption,
                  form.urgency === u && styles.urgencyOptionSelected,
                ]}
                onPress={() => setForm({ ...form, urgency: u })}
              >
                <Text style={styles.urgencyText}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Broadcast to nearby providers</Text>
            <TouchableOpacity
              style={[styles.toggle, form.isBroadcast && styles.toggleActive]}
              onPress={() => setForm({ ...form, isBroadcast: !form.isBroadcast })}
            >
              <Text style={[styles.toggleText, form.isBroadcast && styles.toggleTextActive]}>
                {form.isBroadcast ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Submit Request</Text>
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
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  categoryOptionSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#EFF6FF',
  },
  categoryText: {
    fontSize: 13,
    color: '#374151',
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordInput: {
    flex: 1,
  },
  urgencySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  urgencyOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  urgencyOptionSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#EFF6FF',
  },
  urgencyText: {
    fontSize: 13,
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
    borderColor: '#208AEF',
    backgroundColor: '#EFF6FF',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#208AEF',
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
