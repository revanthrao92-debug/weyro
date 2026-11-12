import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  Star,
} from 'lucide-react-native';
import {
  Button,
  Chip,
  EmptyState,
  Input,
  PressableScale,
  ScreenContainer,
  SectionHead,
  Skeleton,
} from '@/components/ui';
import { useAddresses, useVehicles } from '@/hooks/useProfile';
import {
  LocationField,
  LocationPicker,
  type PickedLocation,
} from '@/maps';
import {
  useAvailableDrivers,
  useCreateDriverBooking,
  type CustomerDriver,
  type CustomerDriverBooking,
} from '@/hooks/useDriverGoCustomer';
import { jobWhen, money } from '@/components/driver/driverFormat';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

const TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
const HOURLY = [2, 4, 6, 8];

const pad = (value: number) => String(value).padStart(2, '0');

function datePlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildStart(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`);
}

function startIsFuture(startAt: Date) {
  return (
    !Number.isNaN(startAt.getTime()) &&
    startAt.getTime() >= Date.now() + 30 * 60 * 1000
  );
}

function vehicleLabel(vehicle: {
  make: string;
  model: string;
  year: number;
  registrationNumber: string;
}) {
  return `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`;
}

export function DriverGoBookingScreen() {
  const router = useRouter();
  const vehiclesQuery = useVehicles();
  const addressesQuery = useAddresses();
  const createBooking = useCreateDriverBooking();

  const vehicles = vehiclesQuery.data?.items ?? [];
  const savedAddress = addressesQuery.data?.addresses?.[0];
  const savedLocation: PickedLocation | null = savedAddress
    ? {
        address: savedAddress.address,
        latitude: savedAddress.latitude,
        longitude: savedAddress.longitude,
        label: savedAddress.title,
      }
    : null;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pickup, setPickup] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<'HOURLY' | 'DAILY'>('HOURLY');
  const [date, setDate] = useState(datePlus(1));
  const [time, setTime] = useState('10:00');
  const [hours, setHours] = useState(2);
  const [days, setDays] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<CustomerDriver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<CustomerDriverBooking | null>(null);

  const vehicle =
    vehicles.find((item) => item.id === vehicleId) ?? vehicles[0] ?? null;
  const effectivePickup = pickup ?? savedLocation;
  const startAt = buildStart(date, time);
  const times = engagement === 'DAILY' ? TIMES.slice(0, 3) : TIMES;

  const driversQuery = useAvailableDrivers(
    step === 2 && effectivePickup && vehicle
      ? {
          startAt: startAt.toISOString(),
          engagement,
          durationHours: engagement === 'HOURLY' ? hours : undefined,
          durationDays: engagement === 'DAILY' ? days : undefined,
          lat: effectivePickup.latitude,
          lng: effectivePickup.longitude,
          transmission:
            (vehicle.transmission as 'MANUAL' | 'AUTOMATIC' | null) ?? undefined,
        }
      : null,
  );

  const back = () => {
    if (booking) {
      router.replace('/driver-go/bookings');
      return;
    }
    if (step > 1) {
      setError(null);
      setStep((step - 1) as 1 | 2);
      return;
    }
    router.back();
  };

  const validateTrip = () => {
    if (!effectivePickup) return 'Add a pickup point.';
    if (!vehicle) return 'Choose a vehicle.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Use a valid date.';
    if (!/^\d{2}:\d{2}$/.test(time)) return 'Choose a start time.';
    if (!startIsFuture(startAt)) {
      return 'Choose a start time at least 30 minutes away.';
    }
    return null;
  };

  const findDrivers = () => {
    const problem = validateTrip();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSelected(null);
    setStep(2);
  };

  const confirm = async () => {
    if (!selected || !vehicle || !effectivePickup) return;
    setError(null);
    try {
      const created = await createBooking.mutateAsync({
        driverId: selected.id,
        vehicleId: vehicle.id,
        engagement,
        scheduleMode: 'SCHEDULED',
        pickupAddress: effectivePickup.address,
        pickupLatitude: effectivePickup.latitude,
        pickupLongitude: effectivePickup.longitude,
        startAt: startAt.toISOString(),
        durationHours: engagement === 'HOURLY' ? hours : undefined,
        durationDays: engagement === 'DAILY' ? days : undefined,
        notes: notes.trim() || undefined,
        transmission:
          (vehicle.transmission as 'MANUAL' | 'AUTOMATIC' | null) ?? undefined,
      });
      setBooking(created);
    } catch (e: any) {
      setError(e?.message || 'Could not create the booking.');
    }
  };

  if (booking) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.success}>
          <CheckCircle2 size={42} color={palette.accent} strokeWidth={1.6} />
          <Text style={styles.successTitle}>Driver requested</Text>
          <Text style={styles.successBody}>
            {booking.driver.name} has your {jobWhen(booking.startAt)} request.
            You’ll see the confirmation in My driver bookings.
          </Text>
          <Button
            title="View booking"
            onPress={() => router.replace(`/driver-go/bookings/${booking.id}`)}
          />
          <Button
            title="My driver bookings"
            variant="secondary"
            onPress={() => router.replace('/driver-go/bookings')}
          />
          <Text style={styles.successNote}>
            Payment is arranged separately during the pilot.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <View style={styles.topBar}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={step > 1 ? 'Previous step' : 'Go back'}
          hitSlop={12}
          style={styles.back}
        >
          <ChevronLeft size={24} color={palette.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.eyebrow}>DRIVER GO</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.progress}>
        <Text style={styles.progressStep}>STEP {step} OF 3</Text>
        <View style={styles.bars}>
          {[1, 2, 3].map((index) => (
            <View
              key={index}
              style={[styles.bar, index <= step && styles.barActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <>
            <Text style={styles.title}>Book a driver</Text>
            <Text style={styles.subtitle}>
              Choose your car, pickup and time. We’ll show verified drivers and
              the fare before you confirm.
            </Text>

            {error ? (
              <View style={styles.banner}>
                <AlertTriangle size={15} color={palette.danger} strokeWidth={2} />
                <Text style={styles.bannerText}>{error}</Text>
              </View>
            ) : null}

            <SectionHead index="01" title="Pickup" />
            <LocationField
              label="Pickup point"
              value={effectivePickup}
              placeholder="Where should the driver meet you?"
              onPress={() => setPickerOpen(true)}
              hint="The driver comes to this address."
            />

            <SectionHead index="02" title="Vehicle" />
            {vehiclesQuery.isLoading ? (
              <Skeleton width="100%" height={70} />
            ) : vehicles.length === 0 ? (
              <EmptyState
                title="Add a vehicle first"
                message="Driver Go uses your own car. Add it to your garage, then come back."
                action={
                  <Button
                    title="Open garage"
                    variant="secondary"
                    onPress={() => router.push('/vehicles')}
                  />
                }
              />
            ) : (
              vehicles.map((item) => {
                const active = item.id === vehicle?.id;
                return (
                  <PressableScale
                    key={item.id}
                    onPress={() => {
                      setVehicleId(item.id);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={vehicleLabel(item)}
                    scaleTo={0.99}
                    style={[styles.vehicleRow, active && styles.vehicleActive]}
                  >
                    <View style={[styles.vehicleIcon, active && styles.vehicleIconActive]}>
                      <Car
                        size={17}
                        color={active ? palette.accent : palette.textMuted}
                        strokeWidth={1.8}
                      />
                    </View>
                    <View style={styles.vehicleText}>
                      <Text style={styles.vehicleTitle}>
                        {item.make} {item.model}
                      </Text>
                      <Text style={styles.vehicleMeta}>
                        {item.registrationNumber} · {item.year} ·{' '}
                        {(item.transmission ?? 'transmission not set').toLowerCase()}
                      </Text>
                    </View>
                    {active ? (
                      <Check size={17} color={palette.accent} strokeWidth={2.2} />
                    ) : null}
                  </PressableScale>
                );
              })
            )}

            <SectionHead index="03" title="When" />
            <Text style={styles.label}>Engagement</Text>
            <View style={styles.chipWrap}>
              <Chip
                label="Hourly"
                selected={engagement === 'HOURLY'}
                onPress={() => {
                  setEngagement('HOURLY');
                  setSelected(null);
                }}
              />
              <Chip
                label="Daily"
                selected={engagement === 'DAILY'}
                onPress={() => {
                  setEngagement('DAILY');
                  setTime('08:00');
                  setSelected(null);
                }}
              />
            </View>

            <Input
              label="Date"
              value={date}
              onChangeText={(value) => {
                setDate(value);
                setSelected(null);
              }}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.quickDates}>
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: 'In 2 days', days: 2 },
              ].map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={date === datePlus(option.days)}
                  onPress={() => {
                    setDate(datePlus(option.days));
                    setSelected(null);
                  }}
                />
              ))}
            </View>

            <Text style={styles.label}>Start time</Text>
            <View style={styles.chipWrap}>
              {times.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  selected={time === option}
                  onPress={() => {
                    setTime(option);
                    setSelected(null);
                  }}
                />
              ))}
            </View>

            <Text style={styles.label}>Duration</Text>
            <View style={styles.chipWrap}>
              {(engagement === 'HOURLY' ? HOURLY : [1]).map((option) => (
                <Chip
                  key={option}
                  label={
                    engagement === 'HOURLY'
                      ? `${option} hours`
                      : `${option} day`
                  }
                  selected={engagement === 'HOURLY' ? hours === option : days === option}
                  onPress={() => {
                    if (engagement === 'HOURLY') setHours(option);
                    else setDays(option);
                    setSelected(null);
                  }}
                />
              ))}
            </View>

            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Destination, stops or instructions"
              multiline
              style={styles.textarea}
            />

            <Button title="Find drivers" onPress={findDrivers} style={styles.cta} />
            <Text style={styles.hint}>
              Payment is arranged separately during the pilot.
            </Text>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>Choose a driver</Text>
            <Text style={styles.subtitle}>
              {date} at {time} · {engagement === 'HOURLY' ? `${hours} hours` : `${days} day`}
              {effectivePickup ? ` · ${effectivePickup.label ?? effectivePickup.address}` : ''}
            </Text>

            {error ? (
              <View style={styles.banner}>
                <AlertTriangle size={15} color={palette.danger} strokeWidth={2} />
                <Text style={styles.bannerText}>{error}</Text>
              </View>
            ) : null}

            {driversQuery.isLoading ? (
              <View style={{ marginTop: spacing.lg }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton
                    key={i}
                    width="100%"
                    height={150}
                    style={{ marginBottom: spacing.sm }}
                  />
                ))}
              </View>
            ) : driversQuery.isError ? (
              <EmptyState
                title="Could not load drivers"
                message="Check your connection and try again."
                action={
                  <Button
                    title="Retry"
                    variant="secondary"
                    onPress={() => void driversQuery.refetch()}
                  />
                }
              />
            ) : (driversQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No drivers for this slot"
                message="All verified drivers are booked or outside their hours. Try another time."
                action={
                  <Button
                    title="Change time"
                    variant="secondary"
                    onPress={() => setStep(1)}
                  />
                }
              />
            ) : (
              driversQuery.data?.items.map((driver) => (
                <PressableScale
                  key={driver.id}
                  onPress={() => {
                    setSelected(driver);
                    setStep(3);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${driver.name}, ${money(driver.quote)}`}
                  scaleTo={0.99}
                  style={styles.driverCard}
                >
                  <View style={styles.driverTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {driver.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.driverText}>
                      <Text style={styles.driverName}>{driver.name}</Text>
                      <View style={styles.ratingRow}>
                        <Star size={11} color={palette.accent} strokeWidth={2} />
                        <Text style={styles.rating}>
                          {driver.rating > 0 ? driver.rating.toFixed(1) : 'New'}
                        </Text>
                        <Text style={styles.meta}>
                          · {driver.experienceYears} yrs · {driver.completedJobs}{' '}
                          {driver.completedJobs === 1 ? 'trip' : 'trips'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.quote}>{money(driver.quote)}</Text>
                  </View>
                  <View style={styles.driverBottom}>
                    <Text style={styles.driverMeta} numberOfLines={1}>
                      {driver.languages.slice(0, 3).join(' · ')}
                    </Text>
                    <Text style={styles.driverMeta}>
                      {driver.distanceKm !== null ? `${driver.distanceKm} km` : ''}
                    </Text>
                  </View>
                </PressableScale>
              ))
            )}
          </>
        ) : null}

        {step === 3 && selected && vehicle && effectivePickup ? (
          <>
            <Text style={styles.title}>Confirm booking</Text>
            <Text style={styles.subtitle}>
              Review the details before sending the request.
            </Text>

            {error ? (
              <View style={styles.banner}>
                <AlertTriangle size={15} color={palette.danger} strokeWidth={2} />
                <Text style={styles.bannerText}>{error}</Text>
              </View>
            ) : null}

            <SectionHead index="01" title="Trip" />
            <View style={styles.summary}>
              <SummaryRow label="Driver" value={selected.name} />
              <SummaryRow label="Pickup" value={effectivePickup.address} />
              <SummaryRow
                label="Start"
                value={`${date} · ${time}`}
              />
              <SummaryRow
                label="Duration"
                value={
                  engagement === 'HOURLY'
                    ? `${hours} hours`
                    : `${days} day · 8 hours`
                }
              />
              <SummaryRow label="Vehicle" value={vehicleLabel(vehicle)} />
              {notes.trim() ? <SummaryRow label="Notes" value={notes.trim()} /> : null}
            </View>

            <SectionHead index="02" title="Fare" />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(selected.quote)}</Text>
            </View>
            <Text style={styles.hint}>
              Payment is arranged separately during the pilot. The fare is fixed
              for the selected duration.
            </Text>

            <View style={styles.policy}>
              <Text style={styles.policyTitle}>Cancellation</Text>
              <Text style={styles.policyBody}>
                Free cancellation while the booking is requested or confirmed,
                before the driver starts the trip. After that, contact support.
              </Text>
            </View>

            <Button
              title="Confirm booking"
              onPress={() => void confirm()}
              loading={createBooking.isPending}
              disabled={createBooking.isPending}
              style={styles.cta}
            />

            <Text style={styles.hint}>
              The driver confirms the request in their app.
            </Text>
          </>
        ) : null}
      </ScrollView>

      {pickerOpen ? (
        <LocationPicker
          visible
          title="Set pickup point"
          hint="Search, use your location or drag the pin"
          initial={effectivePickup}
          confirmLabel="Confirm pickup"
          onClose={() => setPickerOpen(false)}
          onConfirm={(next) => {
            setPickup(next);
            setPickerOpen(false);
            setSelected(null);
            setError(null);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  progress: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  progressStep: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginBottom: spacing.sm,
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
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoftBg,
  },
  bannerText: { ...typography.caption, color: palette.danger, flex: 1 },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  vehicleActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  vehicleIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  vehicleIconActive: { backgroundColor: palette.surface },
  vehicleText: { flex: 1 },
  vehicleTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  vehicleMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    marginTop: 2,
  },
  driverCard: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  driverTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  avatarText: { ...typography.bodyMedium, color: palette.textPrimary },
  driverText: { flex: 1 },
  driverName: { ...typography.bodyMedium, color: palette.textPrimary },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rating: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textPrimary,
  },
  meta: { fontFamily: fontFamilyMono, fontSize: 9, color: palette.textMuted },
  quote: {
    fontFamily: fontFamilyMono,
    fontSize: 14,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  driverBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  driverMeta: {
    ...typography.label,
    color: palette.textMuted,
    flexShrink: 1,
  },
  summary: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  summaryLabel: { ...typography.label, color: palette.textMuted },
  summaryValue: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  totalLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  totalValue: {
    fontFamily: fontFamilyMono,
    fontSize: 22,
    color: palette.textPrimary,
  },
  policy: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  policyTitle: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  policyBody: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  cta: { marginTop: spacing.lg },
  hint: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
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
    marginBottom: spacing.sm,
  },
  successNote: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
  },
});
