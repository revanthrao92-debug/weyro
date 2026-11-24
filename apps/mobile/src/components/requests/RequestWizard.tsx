import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ScreenContainer } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAddresses, useVehicles } from '@/hooks/useProfile';
import { useCreateServiceRequest } from '@/hooks/useRequests';
import { LocationPicker, type PickedLocation } from '@/maps';
import type { UploadedImage } from '@/services/uploads';
import { RequestReview } from './RequestReview';
import { SERVICE_CONFIGS, buildPayload, errorStep, initialUrgency, initialValues, isServiceCategory, resolveUrgency, validateDraft, type DraftContext, type DraftValues, type ManualVehicle, type RequestErrorMap, type ServiceCategory, type ServiceConfig, type SpareFulfillment, type Urgency } from './serviceRequestConfig';
import { palette, spacing } from '@/theme';

import { styles } from './wizard/wizardStyles';
import { Banner } from './wizard/WizardParts';
import { ServiceChooserStep } from './wizard/ServiceChooserStep';
import { DetailsStep } from './wizard/DetailsStep';
import { VehicleSection } from './wizard/VehicleSection';
import { LocationSection } from './wizard/LocationSection';
import { DispatchSection } from './wizard/DispatchSection';

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ['Details', 'Vehicle & location', 'Review'];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
  const [submitted, setSubmitted] = useState<{
    title: string;
    queued: boolean;
  } | null>(null);

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

  const effectiveUrgency: Urgency = config
    ? resolveUrgency(config, values, urgency)
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
        photos: photos.map((photo) => photo.key),
        isBroadcast,
      });
      const result = await createRequest.mutateAsync(payload);
      setSubmitted({
        title: payload.title,
        queued: Boolean((result as { queued?: boolean }).queued),
      });
    } catch (error: any) {
      setFormError(error?.message || 'Could not send the request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer chrome="header" safeBottom>
        <View style={styles.success}>
          <CheckCircle2 size={42} color={palette.accent} strokeWidth={1.6} />
          <Text style={styles.successTitle}>
            {submitted.queued ? 'Request saved' : 'Request sent'}
          </Text>
          <Text style={styles.successBody}>
            {submitted.queued
              ? `${submitted.title} will be sent automatically when your connection returns. It is not with providers yet.`
              : `${submitted.title} is now with nearby verified providers. Quotes will appear in your requests.`}
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
    <ScreenContainer chrome="header" padded={false}>
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

          {step === 0 ? <ServiceChooserStep startService={startService} /> : null}

          {config && step === 1 ? (
            <DetailsStep
              config={config}
              values={values}
              errors={errors}
              setValue={setValue}
              photos={photos}
              setPhotos={setPhotos}
              uploading={uploading}
              setUploading={setUploading}
            />
          ) : null}

          {config && step === 2 ? (
            <>
              <VehicleSection
                vehicles={vehicles}
                vehiclesQuery={vehiclesQuery}
                effectiveVehicleMode={effectiveVehicleMode}
                selectedVehicle={selectedVehicle}
                manualVehicle={manualVehicle}
                errors={errors}
                setVehicleMode={setVehicleMode}
                setSelectedVehicleId={setSelectedVehicleId}
                setManualVehicle={setManualVehicle}
                clearVehicleErrors={clearVehicleErrors}
              />
              <LocationSection
                config={config}
                location={location}
                dropoff={dropoff}
                savedLocation={savedLocation}
                errors={errors}
                spareFulfillment={spareFulfillment}
                setSpareFulfillment={setSpareFulfillment}
                setPicker={setPicker}
                clearError={clearError}
              />
              <DispatchSection
                config={config}
                urgency={urgency}
                setUrgency={setUrgency}
                setFormError={setFormError}
                isBroadcast={isBroadcast}
                setIsBroadcast={setIsBroadcast}
              />
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
