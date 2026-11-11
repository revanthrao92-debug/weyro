import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Chip,
  Input,
  PressableScale,
  ScreenContainer,
  SectionHead,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAddresses, useVehicles } from '@/hooks/useProfile';
import { useCreateServiceRequest } from '@/hooks/useRequests';
import {
  LocationField,
  LocationPicker,
  type PickedLocation,
} from '@/maps';
import { PhotoPicker } from './PhotoPicker';
import type { UploadedImage } from '@/services/uploads';
import { RequestReview } from './RequestReview';
import { VehicleSelector } from './VehicleSelector';
import {
  SERVICE_CONFIGS,
  SERVICE_LIST_ORDER,
  addDaysISO,
  buildPayload,
  errorStep,
  initialUrgency,
  initialValues,
  isServiceCategory,
  urgencyLabel,
  validateDraft,
  type DraftContext,
  type DraftValues,
  type FieldConfig,
  type ManualVehicle,
  type RequestErrorMap,
  type ServiceCategory,
  type ServiceConfig,
  type SpareFulfillment,
  type Urgency,
} from './serviceRequestConfig';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ['Details', 'Vehicle & location', 'Review'];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function FieldBlock({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === 'chips') {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <View style={styles.chipWrap}>
          {field.options?.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={value === option.value}
              onPress={() => onChange(option.value)}
            />
          ))}
        </View>
        {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  if (field.type === 'date') {
    return (
      <View style={styles.field}>
        <Input
          label={label}
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          error={error}
          containerStyle={styles.inputContainer}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {field.future ? (
          <View style={styles.quickDates}>
            {[
              { label: 'Today', days: 0 },
              { label: 'Tomorrow', days: 1 },
              { label: 'In 3 days', days: 3 },
            ].map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={value === addDaysISO(option.days)}
                onPress={() => onChange(addDaysISO(option.days))}
              />
            ))}
          </View>
        ) : null}
        {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        error={error}
        containerStyle={styles.inputContainer}
        multiline={field.type === 'textarea'}
        numberOfLines={field.type === 'textarea' ? 4 : undefined}
        keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
        maxLength={field.maxLength}
        autoCapitalize={field.type === 'number' ? 'none' : 'sentences'}
        style={field.type === 'textarea' ? styles.textarea : undefined}
      />
      {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
    </View>
  );
}

function SavedPlace({
  place,
  detail,
}: {
  place: PickedLocation;
  detail: string;
}) {
  return (
    <View style={styles.savedPlace}>
      <View style={styles.savedIcon}>
        <MapPin size={15} color={palette.accent} strokeWidth={2} />
      </View>
      <View style={styles.savedText}>
        <Text style={styles.savedTitle}>
          {place.label ? `Pickup near ${place.label}` : 'Pickup location'}
        </Text>
        <Text style={styles.savedAddress}>{place.address}</Text>
        <Text style={styles.savedDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function Banner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <AlertTriangle size={15} color={palette.danger} strokeWidth={2} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function RequestWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    category?: string | string[];
    title?: string | string[];
    urgency?: string | string[];
  }>();
  const categoryParam = firstParam(params.category);
  const titleParam = firstParam(params.title);
  const urgencyParam = firstParam(params.urgency);
  const initialCategory = isServiceCategory(categoryParam) ? categoryParam : null;

  const [category, setCategory] = useState<ServiceCategory | null>(initialCategory);
  const [values, setValues] = useState<DraftValues>(() =>
    initialCategory
      ? initialValues(SERVICE_CONFIGS[initialCategory], titleParam, urgencyParam)
      : {},
  );
  const [urgency, setUrgency] = useState<Urgency>(() =>
    initialCategory
      ? initialUrgency(SERVICE_CONFIGS[initialCategory], urgencyParam)
      : 'NORMAL',
  );
  const [step, setStep] = useState<Step>(initialCategory ? 1 : 0);
  const [errors, setErrors] = useState<RequestErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ title: string } | null>(null);

  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isBroadcast, setIsBroadcast] = useState(true);

  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [dropoff, setDropoff] = useState<PickedLocation | null>(null);
  const [picker, setPicker] = useState<'pickup' | 'dropoff' | null>(null);

  const [vehicleMode, setVehicleMode] = useState<'saved' | 'manual'>('saved');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [manualVehicle, setManualVehicle] = useState<ManualVehicle>({
    make: '',
    model: '',
    year: '',
  });
  const [spareFulfillment, setSpareFulfillment] =
    useState<SpareFulfillment>('PICKUP');

  const vehiclesQuery = useVehicles();
  const addressesQuery = useAddresses();
  const createRequest = useCreateServiceRequest();
  const { user, customerProfile } = useAuth();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const config: ServiceConfig | null = category
    ? SERVICE_CONFIGS[category]
    : null;
  const vehicles = vehiclesQuery.data?.items ?? [];
  const savedPrimary = addressesQuery.data?.addresses?.[0];
  const savedLocation: PickedLocation | null = savedPrimary
    ? {
        address: savedPrimary.address,
        latitude: savedPrimary.latitude,
        longitude: savedPrimary.longitude,
        label: savedPrimary.title,
      }
    : null;

  const effectiveVehicleMode: 'saved' | 'manual' | 'loading' =
    vehicleMode === 'manual'
      ? 'manual'
      : vehicles.length > 0
        ? 'saved'
        : vehiclesQuery.isLoading
          ? 'loading'
          : 'manual';

  const selectedVehicle =
    effectiveVehicleMode === 'saved'
      ? vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
        vehicles[0] ??
        null
      : null;

  const effectiveUrgency: Urgency =
    config?.urgencyMode === 'emergency'
      ? values.emergency === 'Yes'
        ? 'EMERGENCY'
        : 'NORMAL'
      : urgency;

  const ctx: DraftContext = {
    values,
    urgency: effectiveUrgency,
    location,
    dropoff,
    savedLocation,
    selectedVehicle,
    manualVehicle,
    spareFulfillment,
    photoCount: photos.length,
    isBroadcast,
  };

  const contactName =
    [customerProfile?.firstName, customerProfile?.lastName]
      .filter(Boolean)
      .join(' ') || 'Your account';
  const contactDetail = user?.phone || user?.email || '';

  const clearError = (key: string) => {
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    clearError(key);
  };

  const startService = (next: ServiceCategory) => {
    const nextConfig = SERVICE_CONFIGS[next];
    setCategory(next);
    setValues(initialValues(nextConfig, titleParam, urgencyParam));
    setUrgency(initialUrgency(nextConfig, urgencyParam));
    setSpareFulfillment('PICKUP');
    setErrors({});
    setFormError(null);
    setStep(1);
  };

  const clearVehicleErrors = () => {
    setErrors((current) => {
      const next = { ...current };
      delete next.vehicle;
      delete next.manualMake;
      delete next.manualModel;
      delete next.manualYear;
      return next;
    });
    setFormError(null);
  };

  const scrollTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goNext = () => {
    if (!config) return;
    const { errors: found } = validateDraft(config, ctx);
    const visible =
      step === 1
        ? Object.fromEntries(
            Object.entries(found).filter(([key]) => errorStep(key) === 1),
          )
        : found;
    setErrors(visible);
    if (Object.keys(visible).length > 0) {
      setFormError('Check the highlighted fields before continuing.');
      return;
    }
    setFormError(null);
    setStep(step === 1 ? 2 : 3);
    scrollTop();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
      setFormError(null);
      scrollTop();
      return;
    }
    router.back();
  };

  const submit = async () => {
    if (!config) return;
    const { errors: found, firstStep } = validateDraft(config, ctx);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('Check the highlighted fields before sending.');
      setStep(firstStep);
      scrollTop();
      return;
    }
    if (uploading) {
      setFormError('Wait for the photos to finish uploading.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = buildPayload(config, ctx, {
        photos: photos.map((photo) => photo.url),
        isBroadcast,
      });
      await createRequest.mutateAsync(payload);
      setSubmitted({ title: payload.title });
    } catch (error: any) {
      setFormError(error?.message || 'Could not send the request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.success}>
          <CheckCircle2 size={42} color={palette.accent} strokeWidth={1.6} />
          <Text style={styles.successTitle}>Request sent</Text>
          <Text style={styles.successBody}>
            {submitted.title} is now with nearby verified providers. Quotes will
            appear in your requests.
          </Text>
          <Button
            title="View my requests"
            onPress={() => router.replace('/requests/my')}
          />
          <Button
            title="Back to home"
            variant="secondary"
            onPress={() => router.replace('/')}
          />
        </View>
      </ScreenContainer>
    );
  }

  const pageTitle =
    step === 0
      ? 'What do you need?'
      : step === 1
        ? config?.title ?? 'New request'
        : step === 2
          ? 'Vehicle & location'
          : 'Review request';
  const pageSubtitle =
    step === 0
      ? 'Choose a service. We only ask for what that service needs.'
      : step === 1
        ? config?.subtitle ?? ''
        : step === 2
          ? 'Reuse your saved details. Change anything that differs.'
          : 'Check everything before providers see it.';

  const primaryTitle =
    step === 1 ? 'Continue' : step === 2 ? 'Review request' : 'Submit request';

  return (
    <ScreenContainer chrome="dark" padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={step > 1 ? 'Go to previous step' : 'Go back'}
            hitSlop={12}
            style={styles.back}
          >
            <ChevronLeft size={24} color={palette.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.eyebrow}>New request</Text>
          <View style={styles.back} />
        </View>

        {step > 0 ? (
          <View style={styles.progress}>
            <View style={styles.progressText}>
              <Text style={styles.progressStep}>STEP {step} OF 3</Text>
              <Text style={styles.progressLabel}>{STEP_LABELS[step - 1]}</Text>
            </View>
            <View style={styles.bars}>
              {[1, 2, 3].map((index) => (
                <View
                  key={index}
                  style={[styles.bar, index <= step && styles.barActive]}
                />
              ))}
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{pageTitle}</Text>
          <Text style={styles.subtitle}>{pageSubtitle}</Text>

          {formError ? <Banner message={formError} /> : null}

          {step === 0 ? (
            <View style={styles.services}>
              {SERVICE_LIST_ORDER.map((service, index) => (
                <PressableScale
                  key={service.category}
                  onPress={() => startService(service.category)}
                  accessibilityRole="button"
                  accessibilityLabel={service.label}
                  scaleTo={0.99}
                  style={[styles.serviceRow, index > 0 && styles.divider]}
                >
                  <Text style={styles.serviceIndex}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <View style={styles.serviceText}>
                    <Text style={styles.serviceLabel}>{service.label}</Text>
                    <Text style={styles.serviceDetail}>{service.detail}</Text>
                  </View>
                  <ChevronRight
                    size={16}
                    color={palette.textMuted}
                    strokeWidth={1.8}
                  />
                </PressableScale>
              ))}
            </View>
          ) : null}

          {config && step === 1 ? (
            <>
              <SectionHead index="01" title={config.detailsTitle} />
              {config.fields.map((field) => (
                <FieldBlock
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ''}
                  error={errors[field.key]}
                  onChange={(next) => setValue(field.key, next)}
                />
              ))}

              {config.photos ? (
                <>
                  <SectionHead index="02" title={config.photos.label} />
                  <PhotoPicker
                    images={photos}
                    onChange={setPhotos}
                    max={config.photos.max}
                    onUploadingChange={setUploading}
                    helper={
                      uploading ? 'Uploading photos…' : config.photos.help
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}

          {config && step === 2 ? (
            <>
              <SectionHead index="01" title="Vehicle" />
              <VehicleSelector
                vehicles={vehicles}
                isError={vehiclesQuery.isError}
                mode={effectiveVehicleMode}
                selectedId={selectedVehicle?.id ?? null}
                manual={manualVehicle}
                errors={errors}
                onSelect={(id) => {
                  setVehicleMode('saved');
                  setSelectedVehicleId(id);
                  clearVehicleErrors();
                }}
                onManual={() => {
                  setVehicleMode('manual');
                  clearVehicleErrors();
                }}
                onSaved={() => {
                  setVehicleMode('saved');
                  clearVehicleErrors();
                }}
                onManualChange={(patch) => {
                  setManualVehicle((current) => ({ ...current, ...patch }));
                  clearVehicleErrors();
                }}
              />

              <SectionHead
                index="02"
                title={config.locationMode === 'trip' ? 'Route' : 'Location'}
              />
              {config.locationMode === 'trip' ? (
                <>
                  <LocationField
                    label="Pickup point"
                    value={location}
                    placeholder="Where is the vehicle now?"
                    onPress={() => setPicker('pickup')}
                    error={errors.location}
                    hint="Confirm the pickup point. Drag the pin to fine-tune."
                  />
                  <View style={styles.fieldGap} />
                  <LocationField
                    label="Destination"
                    value={dropoff}
                    placeholder="Where should it be towed?"
                    onPress={() => setPicker('dropoff')}
                    error={errors.dropoff}
                    hint="The destination can be a garage or any address."
                  />
                </>
              ) : config.locationMode === 'spare' ? (
                <>
                  <Text style={styles.fieldLabel}>Fulfilment</Text>
                  <View style={styles.chipWrap}>
                    <Chip
                      label="Pick up from dealer"
                      selected={spareFulfillment === 'PICKUP'}
                      onPress={() => {
                        setSpareFulfillment('PICKUP');
                        clearError('location');
                      }}
                    />
                    <Chip
                      label="Deliver to me"
                      selected={spareFulfillment === 'DELIVERY'}
                      onPress={() => {
                        setSpareFulfillment('DELIVERY');
                        clearError('location');
                      }}
                    />
                  </View>
                  {spareFulfillment === 'PICKUP' ? (
                    savedLocation ? (
                      <SavedPlace
                        place={savedLocation}
                        detail="Dealers use this to judge distance. No delivery needed."
                      />
                    ) : (
                      <LocationField
                        label="Your location"
                        value={location}
                        placeholder="Set where you will collect the part"
                        onPress={() => setPicker('pickup')}
                        error={errors.location}
                        hint="Needed to find dealers near you."
                      />
                    )
                  ) : (
                    <LocationField
                      label="Delivery address"
                      value={location ?? savedLocation}
                      placeholder="Where should the part be delivered?"
                      onPress={() => setPicker('pickup')}
                      error={errors.location}
                      hint={
                        savedLocation && !location
                          ? `Using saved address · ${savedLocation.label ?? 'Saved'}`
                          : 'The dealer quotes delivery to this address.'
                      }
                    />
                  )}
                </>
              ) : (
                <LocationField
                  label={config.locationLabel}
                  value={
                    config.requiresExplicitLocation
                      ? location
                      : location ?? savedLocation
                  }
                  placeholder={
                    config.requiresExplicitLocation
                      ? `Set ${config.locationLabel.toLowerCase()}`
                      : 'Choose a location'
                  }
                  onPress={() => setPicker('pickup')}
                  error={errors.location}
                  hint={
                    !location && savedLocation && !config.requiresExplicitLocation
                      ? `Using saved address · ${savedLocation.label ?? 'Saved'}`
                      : config.locationHelp
                  }
                />
              )}

              <SectionHead index="03" title="Dispatch" />
              {config.urgencyMode === 'select' ? (
                <>
                  <Text style={styles.fieldLabel}>Urgency</Text>
                  <View style={styles.chipWrap}>
                    {(['NORMAL', 'URGENT', 'EMERGENCY'] as Urgency[]).map(
                      (option) => (
                        <Chip
                          key={option}
                          label={urgencyLabel(option)}
                          selected={urgency === option}
                          onPress={() => {
                            setUrgency(option);
                            setFormError(null);
                          }}
                        />
                      ),
                    )}
                  </View>
                </>
              ) : null}
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>
                    Broadcast to nearby providers
                  </Text>
                  <Text style={styles.help}>
                    {isBroadcast
                      ? 'Nearby verified providers can send quotes.'
                      : 'Only providers you contact directly will see it.'}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => setIsBroadcast((current) => !current)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isBroadcast }}
                  accessibilityLabel="Broadcast to nearby providers"
                  scaleTo={0.95}
                  style={[styles.toggle, isBroadcast && styles.toggleActive]}
                >
                  <Text
                    style={[
                      styles.toggleValue,
                      isBroadcast && styles.toggleValueActive,
                    ]}
                  >
                    {isBroadcast ? 'On' : 'Off'}
                  </Text>
                </PressableScale>
              </View>
            </>
          ) : null}

          {config && step === 3 ? (
            <RequestReview
              config={config}
              ctx={ctx}
              photos={photos}
              contact={{ name: contactName, detail: contactDetail }}
              onEdit={(target) => {
                setStep(target);
                scrollTop();
              }}
              onChangePickup={(next) => {
                setLocation(next);
                clearError('location');
              }}
              onChangeDropoff={(next) => {
                setDropoff(next);
                clearError('dropoff');
              }}
            />
          ) : null}
        </ScrollView>

        {step > 0 ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            {step > 1 ? (
              <Button
                title="Back"
                variant="secondary"
                onPress={handleBack}
                style={styles.footerButton}
              />
            ) : null}
            <Button
              title={primaryTitle}
              onPress={step === 3 ? submit : goNext}
              loading={submitting}
              disabled={submitting || uploading}
              style={styles.footerButton}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {picker !== null ? (
        <LocationPicker
          visible
          title={
            picker === 'dropoff'
              ? 'Set destination'
              : config?.locationMode === 'trip'
                ? 'Set pickup point'
                : config?.locationLabel ?? 'Set location'
          }
          hint={
            picker === 'dropoff'
              ? 'Search or drag the pin'
              : config?.category === 'ROADSIDE'
                ? 'Use your current location or adjust the pin'
                : 'Search, tap a saved place, or drag the pin'
          }
          initial={
            picker === 'dropoff'
              ? dropoff
              : location ?? savedLocation
          }
          useSavedFallback={picker !== 'dropoff'}
          confirmLabel={
            picker === 'dropoff' ? 'Confirm destination' : 'Confirm location'
          }
          onClose={() => setPicker(null)}
          onConfirm={(next) => {
            if (picker === 'dropoff') {
              setDropoff(next);
              clearError('dropoff');
            } else {
              setLocation(next);
              clearError('location');
            }
            setPicker(null);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  progress: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  progressText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressStep: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    letterSpacing: 0.6,
  },
  progressLabel: {
    ...typography.label,
    color: palette.textSecondary,
  },
  bars: { flexDirection: 'row', gap: 6 },
  bar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.border,
  },
  barActive: { backgroundColor: palette.accent },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  services: { marginTop: spacing.lg },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  serviceIndex: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  serviceText: { flex: 1 },
  serviceLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  serviceDetail: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
  field: { gap: spacing.xs, marginBottom: spacing.lg },
  inputContainer: { marginBottom: 0 },
  fieldLabel: {
    ...typography.label,
    color: palette.textSecondary,
    marginBottom: 2,
  },
  required: { color: palette.accent },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  help: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  error: { ...typography.caption, color: palette.danger },
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  textarea: { minHeight: 104, textAlignVertical: 'top' },
  fieldGap: { height: spacing.md },
  savedPlace: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
  },
  savedIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoftBg,
  },
  savedText: { flex: 1 },
  savedTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  savedAddress: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  savedDetail: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleText: { flex: 1 },
  toggleLabel: { ...typography.body, color: palette.textPrimary },
  toggle: {
    minWidth: 58,
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
  toggleValue: { ...typography.label, color: palette.textSecondary },
  toggleValueActive: { color: palette.accent },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoftBg,
  },
  bannerText: { ...typography.caption, color: palette.danger, flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.canvas,
  },
  footerButton: { flex: 1 },
  success: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  successTitle: {
    fontFamily: displayFamily,
    fontSize: 30,
    color: palette.textPrimary,
    marginTop: spacing.sm,
  },
  successBody: {
    ...typography.body,
    color: palette.textSecondary,
    marginBottom: spacing.md,
  },
});
