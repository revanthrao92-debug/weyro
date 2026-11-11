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
import { useAddresses } from '@/hooks/useProfile';
import { Input, Button, Chip, BackButton, ScreenContainer, FadeSlideIn } from '@/components/ui';
import { PhotoPicker } from '@/components/requests/PhotoPicker';
import {
  LocationField,
  LocationPicker,
  RoutePreview,
  hasMapAccess,
  haversineMeters,
  type PickedLocation,
} from '@/maps';
import type { UploadedImage } from '@/services/uploads';
import { palette, spacing, radii, typography } from '@/theme';
import { titleize as labelize } from '@/utils/format';

const CATEGORIES = ['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'];
const URGENCIES = ['NORMAL', 'URGENT', 'EMERGENCY'];
const TOWING_TYPES = [
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'HOOK_AND_CHAIN', label: 'Hook & chain' },
  { value: 'MOTORCYCLE', label: 'Motorcycle' },
  { value: 'ANY', label: 'Any' },
];
const ROADSIDE_KINDS = [
  { value: 'BATTERY', label: 'Battery' },
  { value: 'TYRE', label: 'Flat tyre' },
  { value: 'FUEL', label: 'Out of fuel' },
];
const FULFILMENTS = [
  { value: 'PICKUP', label: 'Pick up from dealer' },
  { value: 'DELIVERY', label: 'Deliver to me' },
];

const COPY: Record<string, { title: string; subtitle: string }> = {
  REPAIR: {
    title: 'Report an issue',
    subtitle: 'Add photos and a few details. Verified garages nearby send quotes.',
  },
  MAINTENANCE: {
    title: 'Book maintenance',
    subtitle: 'Tell us what the vehicle needs. Garages send service quotes.',
  },
  SPARE_PART: {
    title: 'Request a part',
    subtitle: 'Describe the part. Dealers reply with price and availability.',
  },
  TOWING: {
    title: 'Request a tow',
    subtitle: 'Set the pickup and destination so towers can quote the trip.',
  },
  ROADSIDE: {
    title: 'Roadside assistance',
    subtitle: 'Confirm where you are so the nearest help can reach you.',
  },
  INSPECTION: {
    title: 'Book an inspection',
    subtitle: 'Choose where the vehicle will be inspected.',
  },
};

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
    urgency: ['NORMAL', 'URGENT', 'EMERGENCY'].includes(requestedUrgency ?? '')
      ? (requestedUrgency as string)
      : 'NORMAL',
    mediaUrls: [],
    damagePhotos: [],
    isBroadcast: true,
  });

  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [dropoff, setDropoff] = useState<PickedLocation | null>(null);
  const [picker, setPicker] = useState<'pickup' | 'dropoff' | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dropoffError, setDropoffError] = useState<string | null>(null);
  const [towingType, setTowingType] = useState('ANY');
  const [roadsideKind, setRoadsideKind] = useState('BATTERY');
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');

  const [submitting, setSubmitting] = useState(false);
  const createRequest = useCreateServiceRequest();
  const router = useRouter();
  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: addressesData } = useAddresses();
  const savedPrimary = addressesData?.addresses?.[0];
  const savedLocation: PickedLocation | null = savedPrimary
    ? {
        address: savedPrimary.address,
        latitude: savedPrimary.latitude,
        longitude: savedPrimary.longitude,
        label: savedPrimary.title,
      }
    : null;

  const { category } = form;
  const isTowing = category === 'TOWING';
  const isRoadside = category === 'ROADSIDE';
  const isSpare = category === 'SPARE_PART';
  const isDelivery = isSpare && fulfillment === 'DELIVERY';

  // Mandatory confirmations for the services where the exact point matters.
  const requiresExplicit =
    isTowing || isRoadside || isDelivery || category === 'INSPECTION';
  const primary = location ?? (requiresExplicit ? null : savedLocation);

  const copy = COPY[category] ?? COPY.REPAIR;

  const locationTitle = isTowing
    ? 'Route'
    : isRoadside
      ? 'Assistance point'
      : category === 'INSPECTION'
        ? 'Inspection location'
        : category === 'MAINTENANCE'
          ? 'Service location'
          : isSpare
            ? 'Delivery'
            : 'Vehicle location';

  const locationLabel = isTowing
    ? 'Pickup point'
    : isRoadside
      ? 'Assistance location'
      : category === 'INSPECTION'
        ? 'Inspection location'
        : category === 'MAINTENANCE'
          ? 'Garage or service address'
          : isSpare
            ? 'Delivery address'
            : 'Vehicle location';

  const locationPlaceholder = isTowing
    ? 'Where is the vehicle now?'
    : isRoadside
      ? 'Pin where you need help'
      : category === 'INSPECTION'
        ? 'Where should we inspect the vehicle?'
        : category === 'MAINTENANCE'
          ? 'Choose a garage or your address'
          : isSpare
            ? 'Where should the part be delivered?'
            : 'Optional — helps match nearby garages';

  const pickerTitle =
    picker === 'dropoff'
      ? 'Set destination'
      : isTowing
        ? 'Set pickup point'
        : isRoadside
          ? 'Confirm assistance location'
          : category === 'INSPECTION'
            ? 'Set inspection location'
            : isSpare
              ? 'Set delivery address'
              : category === 'MAINTENANCE'
                ? 'Set service location'
                : 'Set vehicle location';

  const pickerInitial = picker === 'dropoff' ? dropoff : location ?? savedLocation;

  const fail = (message: string) => {
    setFormError(message);
    Alert.alert('Check the request', message);
  };

  const handleSubmit = async () => {
    const { vehicleMake, vehicleModel, vehicleYear, title, description, urgency, isBroadcast } = form;
    setFormError(null);

    if (!vehicleMake || !vehicleModel || !vehicleYear || !title || !description) {
      fail('Add the vehicle and a short description first.');
      return;
    }

    if (!primary) {
      setLocationError('Choose a location to continue.');
      fail(
        requiresExplicit
          ? 'Confirm the location so providers know where to go.'
          : 'Set a location or save an address in your profile.',
      );
      return;
    }

    if (isTowing) {
      if (!dropoff) {
        setDropoffError('Add the destination for the tow.');
        fail('Towing needs a pickup and a destination.');
        return;
      }
      if (haversineMeters(primary, dropoff) < 50) {
        setDropoffError('Pickup and destination are too close.');
        fail('Pickup and destination look like the same place.');
        return;
      }
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
        address: primary.address,
        latitude: primary.latitude,
        longitude: primary.longitude,
        urgency: urgency as any,
        mediaUrls: photos.map((p) => p.url),
        damagePhotos: photos.map((p) => p.url),
        isBroadcast,
        ...(isTowing && dropoff
          ? {
              fulfillmentType: 'TOW_TO_GARAGE',
              dropoffAddress: dropoff.address,
              dropoffLatitude: dropoff.latitude,
              dropoffLongitude: dropoff.longitude,
              towingVehicleType: towingType as any,
            }
          : {}),
        ...(isSpare
          ? { fulfillmentType: isDelivery ? 'PARTS_SHIPPING' : 'WORKSHOP_VISIT' }
          : {}),
        ...(category === 'MAINTENANCE' || category === 'INSPECTION' || category === 'REPAIR'
          ? { fulfillmentType: 'ON_SITE' }
          : {}),
        ...(isRoadside ? { roadsideKind: roadsideKind as any } : {}),
      });
      Alert.alert('Request created', 'Providers nearby can now respond.');
      router.replace('/requests/my');
    } catch (e: any) {
      setFormError(e?.message || 'Unable to create request. Try again.');
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

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

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
                  onPress={() => {
                    setForm({ ...form, category: c });
                    setLocationError(null);
                    setDropoffError(null);
                  }}
                />
              ))}
            </View>

            {isRoadside ? (
              <>
                <Text style={styles.label}>What do you need?</Text>
                <View style={styles.chipWrap}>
                  {ROADSIDE_KINDS.map((kind) => (
                    <Chip
                      key={kind.value}
                      label={kind.label}
                      selected={roadsideKind === kind.value}
                      onPress={() => setRoadsideKind(kind.value)}
                    />
                  ))}
                </View>
              </>
            ) : null}
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

          <Section number="04" title={locationTitle}>
            {isTowing ? (
              <>
                <LocationField
                  label="Pickup point"
                  value={location}
                  placeholder="Where is the vehicle now?"
                  onPress={() => setPicker('pickup')}
                  error={locationError ?? undefined}
                  hint="Drag the pin on the map to fine-tune it."
                />
                <View style={styles.fieldGap} />
                <LocationField
                  label="Destination"
                  value={dropoff}
                  placeholder="Where should it be towed?"
                  onPress={() => setPicker('dropoff')}
                  error={dropoffError ?? undefined}
                />
                <Text style={styles.label}>Towing equipment</Text>
                <View style={styles.chipWrap}>
                  {TOWING_TYPES.map((type) => (
                    <Chip
                      key={type.value}
                      label={type.label}
                      selected={towingType === type.value}
                      onPress={() => setTowingType(type.value)}
                    />
                  ))}
                </View>
                {location && dropoff ? (
                  hasMapAccess ? (
                    <RoutePreview
                      from={location}
                      to={dropoff}
                      onChange={(which, next) => {
                        if (which === 'from') {
                          setLocation(next);
                          setLocationError(null);
                        } else {
                          setDropoff(next);
                          setDropoffError(null);
                        }
                      }}
                    />
                  ) : (
                    <Text style={styles.hint}>
                      Both points are saved with the request. Distance and ETA
                      need map routing configured.
                    </Text>
                  )
                ) : (
                  <Text style={styles.hint}>
                    Add both points to see the driving distance and ETA.
                  </Text>
                )}
              </>
            ) : isSpare ? (
              <>
                <Text style={styles.label}>Fulfilment</Text>
                <View style={styles.chipWrap}>
                  {FULFILMENTS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={fulfillment === option.value}
                      onPress={() => {
                        setFulfillment(option.value as 'PICKUP' | 'DELIVERY');
                        setLocationError(null);
                      }}
                    />
                  ))}
                </View>
                {isDelivery ? (
                  <>
                    <LocationField
                      label="Delivery address"
                      value={location}
                      placeholder="Where should the part be delivered?"
                      onPress={() => setPicker('pickup')}
                      error={locationError ?? undefined}
                      hint="The dealer quotes delivery on this address."
                    />
                  </>
                ) : savedPrimary ? (
                  <View style={styles.savedNote}>
                    <Text style={styles.savedNoteTitle}>Pickup near {savedPrimary.title}</Text>
                    <Text style={styles.savedNoteText} numberOfLines={2}>
                      {savedPrimary.address}
                    </Text>
                    <Text style={styles.savedNoteHint}>
                      Dealers use this to judge distance. No delivery needed.
                    </Text>
                  </View>
                ) : (
                  <LocationField
                    label="Your location"
                    value={location}
                    placeholder="Set where you will collect the part"
                    onPress={() => setPicker('pickup')}
                    error={locationError ?? undefined}
                    hint="Needed to find dealers near you."
                  />
                )}
              </>
            ) : (
              <LocationField
                label={locationLabel}
                value={primary}
                placeholder={locationPlaceholder}
                onPress={() => setPicker('pickup')}
                error={locationError ?? undefined}
                hint={
                  primary && !location && savedPrimary
                    ? `Using saved address · ${savedPrimary.title}`
                    : isRoadside
                      ? 'Confirm the exact spot — a pin helps the responder find you.'
                      : category === 'INSPECTION'
                        ? 'The inspector goes to this address.'
                        : hasMapAccess
                          ? 'Optional — skip to use your saved address.'
                          : 'Set an address manually or use your saved location.'
                }
              />
            )}
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
            {formError ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}
            <Text style={styles.ctaHint}>
              {uploading ? 'Uploading photos…' : 'Average first quote in under 30 minutes.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationPicker
        visible={picker !== null}
        title={pickerTitle}
        hint={
          picker === 'dropoff'
            ? 'Search or drag the pin'
            : isRoadside
              ? 'Use your current location or adjust the pin'
              : 'Search, tap a saved place, or drag the pin'
        }
        initial={pickerInitial}
        useSavedFallback={picker !== 'dropoff'}
        confirmLabel={picker === 'dropoff' ? 'Confirm destination' : 'Confirm location'}
        onClose={() => setPicker(null)}
        onConfirm={(next) => {
          if (picker === 'dropoff') {
            setDropoff(next);
            setDropoffError(null);
          } else {
            setLocation(next);
            setLocationError(null);
          }
          setPicker(null);
        }}
      />
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
  fieldGap: { height: spacing.sm },
  hint: { ...typography.caption, color: palette.textMuted },
  savedNote: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: 2,
  },
  savedNoteTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  savedNoteText: { ...typography.caption, color: palette.textSecondary },
  savedNoteHint: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
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
  formError: {
    ...typography.caption,
    color: palette.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  ctaHint: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
