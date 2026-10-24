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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateServiceRequest } from '@/hooks/useRequests';
import { Input, Button, Chip, AppHeader, BackButton } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const CATEGORIES = ['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'];
const URGENCIES = ['NORMAL', 'URGENT', 'EMERGENCY'];

function labelize(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase().replace('_', ' ');
}

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
  const insets = useSafeAreaInsets();

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
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <AppHeader
        title="Report Damage"
        subtitle="Tell us about your vehicle issue"
        left={<BackButton />}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View>
          <Input
            label="Vehicle make"
            placeholder="e.g. Maruti"
            value={form.vehicleMake}
            onChangeText={(t) => setForm({ ...form, vehicleMake: t })}
          />
          <Input
            label="Vehicle model"
            placeholder="e.g. Swift"
            value={form.vehicleModel}
            onChangeText={(t) => setForm({ ...form, vehicleModel: t })}
          />
          <Input
            label="Year"
            placeholder="e.g. 2021"
            value={form.vehicleYear}
            onChangeText={(t) => setForm({ ...form, vehicleYear: t })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={labelize(c)}
                selected={form.category === c}
                onPress={() => setForm({ ...form, category: c })}
              />
            ))}
          </View>

          <Input
            label="Title"
            placeholder="e.g. Front bumper repair"
            value={form.title}
            onChangeText={(t) => setForm({ ...form, title: t })}
          />
          <Input
            label="Description"
            placeholder="Describe the issue..."
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
            style={styles.textarea}
          />
          <Input
            label="Address"
            placeholder="e.g. Indiranagar, Bengaluru"
            value={form.address}
            onChangeText={(t) => setForm({ ...form, address: t })}
          />

          <View style={styles.coordsRow}>
            <View style={styles.coord}>
              <Input
                label="Latitude"
                placeholder="Latitude"
                value={form.latitude}
                onChangeText={(t) => setForm({ ...form, latitude: t })}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.coord}>
              <Input
                label="Longitude"
                placeholder="Longitude"
                value={form.longitude}
                onChangeText={(t) => setForm({ ...form, longitude: t })}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.label}>Urgency</Text>
          <View style={styles.chipWrap}>
            {URGENCIES.map((u) => (
              <Chip
                key={u}
                label={u}
                selected={form.urgency === u}
                onPress={() => setForm({ ...form, urgency: u })}
              />
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Broadcast to nearby providers</Text>
            <TouchableOpacity
              style={[styles.toggle, form.isBroadcast && styles.toggleActive]}
              onPress={() => setForm({ ...form, isBroadcast: !form.isBroadcast })}
              accessibilityRole="switch"
              accessibilityState={{ checked: form.isBroadcast }}
              accessibilityLabel="Broadcast to nearby providers"
            >
              <Text style={[styles.toggleText, form.isBroadcast && styles.toggleTextActive]}>
                {form.isBroadcast ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          title="Submit Request"
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
        />
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
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  coordsRow: { flexDirection: 'row', gap: spacing.sm },
  coord: { flex: 1 },
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
});
