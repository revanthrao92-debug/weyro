import { useEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useIsFocused } from 'expo-router';
import * as Location from 'expo-location';
import {
  getActiveJobId,
  isJobLocationRunning,
  startJobLocationUpdates,
  stopJobLocationUpdates,
} from '@/services/background-location';
import {
  useBooking,
  useUpdateBookingLocation,
  useUpdateBookingStatus,
} from '@/hooks/useBookings';
import {
  AppHeader,
  BackButton,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  ScreenContainer,
  Skeleton,
  StatusPill,
  PopIn,
} from '@/components/ui';
import { Check } from 'lucide-react-native';
import { formatDate, titleize, bookingStatusTone, formatRupees } from '@/utils/format';
import {
  palette,
  spacing,
  typography,
} from '@/theme';

const STEPS = ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PROVIDER_EN_ROUTE: 'On the way',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? titleize(status);
}


export default function MechanicJobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking, isLoading, isError } = useBooking(id ?? '', useIsFocused());
  // Status seen on open; the progress dot only animates for a change after that.
  const [firstStatus, setFirstStatus] = useState<string>();
  if (booking && firstStatus === undefined) setFirstStatus(booking.status);
  const updateStatus = useUpdateBookingStatus();
  const updateLocation = useUpdateBookingLocation();
  const [notes, setNotes] = useState('');
  const [sharing, setSharing] = useState(false);
  // Foreground-only fallback (used when background permission is not granted).
  const watcher = useRef<Location.LocationSubscription | null>(null);

  const stopSharing = () => {
    watcher.current?.remove();
    watcher.current = null;
    void stopJobLocationUpdates();
    setSharing(false);
  };

  // Leaving this screen must NOT stop the background task (that is the point of
  // it) — only the foreground fallback watcher is tied to the screen.
  useEffect(() => () => watcher.current?.remove(), []);

  // Pick up a background task that is already running for this job (e.g. the
  // provider left the screen and came back, or reopened the app).
  useEffect(() => {
    if (!id) return;
    void (async () => {
      if ((await isJobLocationRunning()) && (await getActiveJobId()) === id) setSharing(true);
    })();
  }, [id]);

  // Sharing only makes sense while the job is live. If it ends elsewhere (the
  // customer cancels, an admin completes it) stop reporting.
  const liveStatus = booking?.status;
  useEffect(() => {
    if (sharing && liveStatus && !['PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(liveStatus)) {
      watcher.current?.remove();
      watcher.current = null;
      // Stop the external task first, then reflect it in state.
      void stopJobLocationUpdates().then(() => setSharing(false));
    }
  }, [liveStatus, sharing]);

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Job" subtitle="Loading" />
        <View style={styles.body}>
          <Skeleton width="100%" height={110} />
          <Skeleton width="100%" height={180} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !booking) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Job" />
        <EmptyState
          title="Job unavailable"
          message="This job may have been removed or belongs to another workshop."
          action={<Button title="Go back" onPress={() => router.back()} />}
        />
      </ScreenContainer>
    );
  }

  const request = booking.quotation?.request;
  const customer = booking.customer;
  const who = customer
    ? `${customer.firstName} ${customer.lastName ?? ''}`.trim()
    : 'Customer';
  const vehicle = request?.vehicle
    ? `${request.vehicle.make} ${request.vehicle.model}${
        request.vehicle.year ? ` ${request.vehicle.year}` : ''
      }`
    : 'Vehicle';
  const payment = booking.payment ?? booking.payments?.[0];
  const category = request?.category ?? '';
  const isTowing = category === 'TOWING';
  const isRoadside = category === 'ROADSIDE';
  // Drop-off repairs ('PICKUP' in the quote composer): the customer brings the
  // vehicle in, so there is no "on the way" leg (the API allows CONFIRMED -> IN_PROGRESS).
  // A dealer's sale from a part request: packed, then delivered (no "on the way" leg).
  const isParts = category === 'SPARE_PART';
  const isDropOff =
    isParts || (!isTowing && !isRoadside && booking.quotation?.deliveryMethod === 'PICKUP');
  const steps = isDropOff ? STEPS.filter((s) => s !== 'PROVIDER_EN_ROUTE') : STEPS;
  const stepIndex = steps.indexOf(booking.status);
  const STEP_LABEL = isParts
    ? ['Order confirmed', 'Packing', 'Delivered']
    : isTowing
      ? ['Confirmed', 'On the way', 'Towing', 'Delivered']
    : isRoadside
      ? ['Confirmed', 'On the way', 'On site', 'Completed']
      : steps.map(statusLabel);
  const canShareLocation =
    ['PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(booking.status) &&
    (isTowing || isRoadside);

  const advance = async (status: string, withNotes = false) => {
    try {
      await updateStatus.mutateAsync({
        id: booking.id,
        status,
        ...(withNotes && notes.trim() ? { completionNotes: notes.trim() } : {}),
      });
      if (status === 'CANCELLED') haptics.warning();
      else haptics.success();
      if (['COMPLETED', 'CANCELLED'].includes(status)) stopSharing();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update the job.');
    }
  };

  const toggleLiveLocation = async () => {
    if (sharing) {
      stopSharing();
      return;
    }
    try {
      // Provider-only screen: the only place background location is requested.
      const { permission, started } = await startJobLocationUpdates(booking.id);
      if (permission === 'denied') {
        Alert.alert(
          'Location permission needed',
          'Allow location access to share your live position with the customer.',
        );
        return;
      }
      const send = (coords: Location.LocationObjectCoords) => {
        updateLocation
          .mutateAsync({
            id: booking.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
          .catch(() => {});
      };
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      send(current.coords);
      if (!started) {
        // Background permission not granted: share while Weyro is open only.
        watcher.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 45000,
            distanceInterval: 100,
          },
          (position) => send(position.coords),
        );
        Alert.alert(
          'Sharing only while Weyro is open',
          'To keep sharing when you switch apps or lock your phone, set Weyro\'s location access to "Always" in Settings.',
        );
      }
      setSharing(true);
    } catch {
      Alert.alert('Could not start location', 'Location sharing is unavailable on this device.');
    }
  };

  const onPrimary = () => {
    if (booking.status === 'CONFIRMED') {
      return void advance(isDropOff ? 'IN_PROGRESS' : 'PROVIDER_EN_ROUTE');
    }
    if (booking.status === 'PROVIDER_EN_ROUTE') return void advance('IN_PROGRESS');
    if (booking.status === 'IN_PROGRESS') {
      const message = isParts
        ? 'This marks the part delivered and releases the held payment.'
        : 'This marks the work complete and releases the held payment.';
      // Alert.alert shows nothing in a browser, so the job could never be completed there.
      if (Platform.OS === 'web') {
        if (globalThis.confirm?.(`Complete job?\n\n${message}`)) void advance('COMPLETED', true);
        return;
      }
      Alert.alert('Complete job', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => void advance('COMPLETED', true) },
      ]);
    }
  };

  const primaryLabel =
    booking.status === 'CONFIRMED'
      ? isParts
        ? 'Start packing'
        : isDropOff
          ? 'Start job'
          : 'On my way'
      : booking.status === 'PROVIDER_EN_ROUTE'
        ? isTowing
          ? 'Start tow'
          : isRoadside
            ? 'Arrived on site'
            : 'Start job'
        : booking.status === 'IN_PROGRESS'
          ? isTowing
            ? 'Delivered'
            : isParts
              ? 'Mark delivered'
              : 'Complete job'
          : null;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <PageHeader back title={request?.title ?? 'Service job'}>
          <View style={styles.metaRow}>
            <StatusPill
              label={
                booking.status === 'IN_PROGRESS'
                  ? isTowing
                    ? 'Towing'
                    : isRoadside
                      ? 'On site'
                      : isParts
                        ? 'Packing'
                        : 'In progress'
                  : statusLabel(booking.status)
              }
              tone={bookingStatusTone(booking.status)}
            />
            <Text style={styles.meta}>
              Job #{booking.id.slice(0, 8).toUpperCase()}, {titleize(request?.category ?? 'SERVICE')}
            </Text>
          </View>
        </PageHeader>

        <Card style={styles.card}>
          <Text style={styles.amount}>
            {formatRupees(booking.quotation?.totalCost ?? 0)}
          </Text>
          <Text style={styles.meta}>
            {[request?.address ?? 'At the workshop', booking.scheduledAt ? formatDate(booking.scheduledAt) : null]
              .filter(Boolean)
              .join(', ')}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Progress</Text>
          {/* Reached steps ticked, the next one marked; one per line so long labels fit. */}
          <View>
            {steps.map((step, index) => {
              const done = stepIndex >= 0 && index <= stepIndex;
              const next = index === stepIndex + 1 && booking.status !== 'COMPLETED';
              return (
                <View
                  key={step}
                  style={styles.tlRow}
                  accessible
                  accessibilityLabel={`${STEP_LABEL[index]}${done ? ', done' : next ? ', next step' : ''}`}
                >
                  <View style={styles.tlRail}>
                    {index === stepIndex ? (
                      <PopIn key={booking.status} play={firstStatus !== undefined && booking.status !== firstStatus}>
                        <View style={[styles.tlDot, styles.tlDotDone]}>
                          <Check size={12} color={palette.onAccent} strokeWidth={3} />
                        </View>
                      </PopIn>
                    ) : (
                      <View style={[styles.tlDot, done && styles.tlDotDone, next && styles.tlDotNext]}>
                        {done ? <Check size={12} color={palette.onAccent} strokeWidth={3} /> : null}
                      </View>
                    )}
                    {index < steps.length - 1 ? <View style={[styles.tlLine, index < stepIndex && styles.tlLineDone]} /> : null}
                  </View>
                  <View style={styles.tlText}>
                    <Text style={[styles.tlLabel, (done || next) && styles.tlLabelOn, next && styles.tlLabelNext]}>
                      {STEP_LABEL[index]}
                    </Text>
                    {next ? <Text style={styles.meta}>Next step</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
          {booking.startedAt ? (
            <Text style={styles.meta}>Started {formatDate(booking.startedAt)}</Text>
          ) : null}
          {booking.completedAt ? (
            <Text style={styles.meta}>Completed {formatDate(booking.completedAt)}</Text>
          ) : null}
          {booking.completionNotes ? (
            <Text style={styles.notes}>{booking.completionNotes}</Text>
          ) : null}
        </Card>

        {canShareLocation ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Live location</Text>
            <Text style={styles.meta}>
              {sharing
                ? 'Sharing your position with the customer. Updates every 45 seconds.'
                : 'Share your position while travelling to the customer.'}
            </Text>
            <Button
              title={sharing ? 'Stop sharing' : 'Share live location'}
              variant={sharing ? 'destructive' : 'secondary'}
              onPress={() => void toggleLiveLocation()}
            />
          </Card>
        ) : null}

        {primaryLabel ? (
          <Card style={styles.card}>
            {booking.status === 'IN_PROGRESS' ? (
              <Input
                label={isParts ? 'Delivery note (optional)' : 'Completion notes (optional)'}
                placeholder={
                  isParts
                    ? 'Courier and tracking number, or who collected it'
                    : isTowing
                    ? 'Vehicle delivered, condition, handover'
                    : isRoadside
                      ? 'What was fixed on site'
                      : 'Work done, parts replaced, next service'
                }
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            ) : null}
            <Button
              title={primaryLabel}
              loading={updateStatus.isPending}
              onPress={onPrimary}
            />
            {booking.status === 'CONFIRMED' ? (
              <Button
                title="Call off job"
                variant="destructive"
                onPress={() =>
                  Alert.alert('Cancel job', 'Cancel this assigned job?', [
                    { text: 'Keep job', style: 'cancel' },
                    {
                      text: 'Cancel job',
                      style: 'destructive',
                      onPress: () => void advance('CANCELLED'),
                    },
                  ])
                }
              />
            ) : null}
          </Card>
        ) : booking.status === 'CANCELLED' ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Job cancelled</Text>
            <Text style={styles.meta}>This job is no longer active.</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Row label="Name" value={who} />
          <Row label="Vehicle" value={vehicle} />
          <Row label="Service" value={booking.quotation?.etaDescription ?? '—'} />
          {isRoadside && request?.roadsideKind ? (
            <Row label="Assistance" value={titleize(request.roadsideKind)} />
          ) : null}
          {isTowing && request?.towingVehicleType ? (
            <Row label="Towing type" value={titleize(request.towingVehicleType)} />
          ) : null}
          {isTowing && request?.vehicleWeightKg ? (
            <Row
              label="Vehicle weight"
              value={`${Number(request.vehicleWeightKg).toLocaleString('en-IN')} kg`}
            />
          ) : null}
          {isTowing && request?.towingDistanceKm ? (
            <Row label="Distance" value={`${request.towingDistanceKm} km`} />
          ) : null}
          {request?.address ? (
            <Row label={isDropOff ? 'Customer address' : 'Pickup'} value={request.address} />
          ) : null}
          {isTowing && request?.dropoffAddress ? (
            <Row label="Dropoff" value={request.dropoffAddress} />
          ) : null}
          {request?.address ? (
            <Button
              title={isDropOff ? 'Address in maps' : 'Pickup in maps'}
              variant="secondary"
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    request.address,
                  )}`,
                )
              }
            />
          ) : null}
          {isTowing && request?.dropoffAddress ? (
            <Button
              title="Dropoff in maps"
              variant="secondary"
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    request.dropoffAddress!,
                  )}`,
                )
              }
            />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Row
            label="Job value"
            value={formatRupees(booking.quotation?.totalCost ?? 0)}
          />
          <Row
            label="Status"
            value={
              payment?.status
                ? payment.status.toLowerCase()
                : booking.status === 'COMPLETED'
                  ? 'released on completion'
                  : 'held until completion'
            }
          />
          <Text style={styles.meta}>
            Weyro releases funds after the job is confirmed complete. Payout settlement is not yet shown in the app.
          </Text>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tlRow: { flexDirection: 'row', gap: spacing.md },
  tlRail: { alignItems: 'center', width: 20 },
  tlDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotDone: { backgroundColor: palette.accent, borderColor: palette.accent },
  tlDotNext: { borderColor: palette.accent },
  tlLine: { width: 2, flex: 1, minHeight: 18, backgroundColor: palette.border },
  tlLineDone: { backgroundColor: palette.accent },
  tlText: { flex: 1, paddingBottom: spacing.md },
  tlLabel: { ...typography.body, color: palette.textMuted },
  tlLabelOn: { color: palette.textPrimary },
  tlLabelNext: { fontWeight: '600' },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  meta: { ...typography.caption, color: palette.textMuted, lineHeight: 18 },
  card: { marginTop: spacing.lg, gap: spacing.md },
  amount: { ...typography.title, color: palette.textPrimary },
  sectionTitle: { ...typography.captionMedium, color: palette.textPrimary },
  notes: { ...typography.caption, color: palette.textSecondary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: { ...typography.label, color: palette.textMuted },
  rowValue: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});
