import { useState, type ReactNode } from 'react';
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
import { useCreateServiceRequest } from '@/hooks/useRequests';
import { Input, Button, Chip, BackButton, ScreenContainer, FadeSlideIn } from '@/components/ui';
import { PhotoPicker } from '@/components/requests/PhotoPicker';
import type { UploadedImage } from '@/services/uploads';
import { palette, spacing, radii, typography } from '@/theme';
import { titleize as labelize } from '@/utils/format';

const CATEGORIES = ['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'];
const URGENCIES = ['NORMAL', 'URGENT', 'EMERGENCY'];

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  const delay = Number(number) * 45;

  return (
    <FadeSlideIn delay={delay}>
      <View style={styles.section}>
          <View style={styles.sectionHead}>
          <Text style={styles.sectionNumber}>{number}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {children}
      </View>
    </FadeSlideIn>
  );
}

export default function CreateRequestScreen() {
  const {
    category: requestedCategory,
    title: requestedTitle,
    urgency: requestedUrgency,
  } = useLocalSearchParams<{ category?: string; title?: string; urgency?: string }>();
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
    category: CATEGORIES.includes(requestedCategory ?? '') ? (requestedCategory as string) : 'REPAIR',
    title: requestedTitle ?? '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    urgency: ['NORMAL', 'URGENT', 'EMERGENCY'].includes(requestedUrgency ?? '')
      ? (requestedUrgency as string)
      : 'NORMAL',
    mediaUrls: [],
    damagePhotos: [],
    isBroadcast: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const createRequest = useCreateServiceRequest();
  const router = useRouter();
  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

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
        mediaUrls: photos.map((p) => p.url),
        damagePhotos: photos.map((p) => p.url),
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
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <BackButton />
            <Text style={styles.eyebrow}>New request</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <Text style={styles.title}>Report an issue</Text>
          <Text style={styles.subtitle}>
            Add photos and a few details. Verified garages nearby send quotes.
          </Text>

          <Section number="01" title="Photos">
            <View style={styles.uploadBox}>
              <PhotoPicker
                images={photos}
                onChange={setPhotos}
                onUploadingChange={setUploading}
                max={4}
              />
            </View>
          </Section>

          <Section number="02" title="Describe the issue">
            <Input
              label="Title"
              placeholder="e.g. Front bumper repair"
              value={form.title}
              onChangeText={(t) => setForm({ ...form, title: t })}
            />
            <Input
              label="Details"
              placeholder="What happened, and what needs fixing?"
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
              multiline
              style={styles.textarea}
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
          </Section>

          <Section number="03" title="Vehicle">
            <Input
              label="Make"
              placeholder="e.g. Maruti"
              value={form.vehicleMake}
              onChangeText={(t) => setForm({ ...form, vehicleMake: t })}
            />
            <Input
              label="Model"
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
          </Section>

          <Section number="04" title="Location">
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
          </Section>

          <Section number="05" title="Dispatch">
            <Text style={styles.label}>Urgency</Text>
            <View style={styles.chipWrap}>
              {URGENCIES.map((u) => (
                <Chip
                  key={u}
                  label={labelize(u)}
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
          </Section>

          <View style={styles.cta}>
            <Button
              title="Submit request"
              onPress={handleSubmit}
              disabled={submitting || uploading}
              loading={submitting}
            />
            <Text style={styles.ctaHint}>
              {uploading ? 'Uploading photos…' : 'Average first quote in under 30 minutes.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  topBarSpacer: { width: 44 },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { ...typography.display, color: palette.textPrimary },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionNumber: { ...typography.label, color: palette.accent },
  sectionTitle: {
    ...typography.label,
    color: palette.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
  },
  coordsRow: { flexDirection: 'row', gap: spacing.sm },
  coord: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  cta: { marginTop: spacing.xxl },
  ctaHint: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
