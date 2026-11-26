import { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { titleize } from '@/utils/format';
import {
  MapPin,
  Navigation,
  Phone,
  UserRound,
} from 'lucide-react-native';
import {
  PageHeader,
  Button,
  ButtonRow,
  EmptyState,
  ScreenContainer,
  SectionHead,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import {
  useAcceptDriverJob,
  useDeclineDriverJob,
  useDriverJob,
  useUpdateDriverJobStatus,
  useVerifyDriverStartOtp,
} from '@/hooks/useDriverGo';
import {
  customerName,
  durationLabel,
  jobStatusLabel,
  jobStatusTone,
  jobWhen,
  money,
  nextTripStep,
  vehicleLabel,
} from './driverFormat';
import { confirmAction } from '@/lib/confirm';
import {
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function mapUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function DriverBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = id ?? '';
  const router = useRouter();

  const jobQuery = useDriverJob(jobId);
  const acceptJob = useAcceptDriverJob();
  const declineJob = useDeclineDriverJob();
  const updateStatus = useUpdateDriverJobStatus();
  const verifyOtp = useVerifyDriverStartOtp();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (jobQuery.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <View style={styles.headerPad}>
          <PageHeader back title="Trip" />
        </View>
        <View style={styles.body}>
          <Skeleton width="60%" height={28} />
          <Skeleton width="100%" height={120} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={90} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <View style={styles.headerPad}>
          <PageHeader back title="Trip" />
        </View>
        <EmptyState
          title="Trip not found"
          message="This trip may have been reassigned or cancelled."
        />
      </ScreenContainer>
    );
  }

  const job = jobQuery.data;
  const pending =
    acceptJob.isPending ||
    declineJob.isPending ||
    updateStatus.isPending ||
    verifyOtp.isPending;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(e?.message || 'Could not update this trip.');
    }
  };

  const accept = () => run(() => acceptJob.mutateAsync(job.id));
  const decline = async () => {
    if (!(await confirmAction('Decline this trip?', 'The customer will look for another driver.', 'Decline'))) return;
    await run(async () => {
      await declineJob.mutateAsync({ id: job.id });
      if (router.canGoBack()) router.back();
      else router.replace('/driver-jobs');
    });
  };
  const step = nextTripStep(job.status);
  const advance = async () => {
    if (step?.next) return run(() => updateStatus.mutateAsync({ id: job.id, status: step.next! }));
    if (!(await confirmAction('End this trip?', 'Only end it once the customer has the car back.', 'End trip'))) return;
    await run(() => updateStatus.mutateAsync({ id: job.id, status: 'COMPLETED' }));
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader back title={jobWhen(job.startAt)}>
          <View style={styles.headMeta}>
            <StatusPill label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
            <Text style={styles.subtitle}>
              {[
                durationLabel(job),
                job.engagement === 'DAILY' ? 'Daily' : 'Hourly',
                job.scheduleMode === 'ON_DEMAND' ? 'On demand' : 'Scheduled',
              ].join(', ')}
            </Text>
          </View>
        </PageHeader>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SectionHead title="Customer" />
        <View style={styles.personRow}>
          <View style={styles.avatar}>
            <UserRound size={20} color={palette.textPrimary} strokeWidth={1.7} />
          </View>
          <View style={styles.personText}>
            <Text style={styles.personName}>{customerName(job)}</Text>
            {job.customer.phoneMasked ? (
              <View style={styles.phoneRow}>
                <Phone size={12} color={palette.textMuted} strokeWidth={1.8} />
                <Text style={styles.phone}>{job.customer.phoneMasked}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <SectionHead title="Vehicle" />
        <Row label="Vehicle" value={vehicleLabel(job)} />
        <Row
          label="Transmission"
          value={titleize(job.vehicle?.transmission ?? job.transmission ?? 'Not specified')}
        />

        <SectionHead title="Route" />
        <View style={styles.placeRow}>
          <View style={styles.placeIcon}>
            <MapPin size={14} color={palette.accent} strokeWidth={2} />
          </View>
          <View style={styles.placeText}>
            <Text style={styles.placeLabel}>Pickup</Text>
            <Text style={styles.placeValue}>{job.pickupAddress}</Text>
          </View>
          <Button
            title="Maps"
            variant="secondary"
            onPress={() =>
              void Linking.openURL(
                mapUrl(job.pickupLatitude, job.pickupLongitude),
              )
            }
            style={styles.mapButton}
          />
        </View>
        {job.destinationAddress ? (
          <View style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <Navigation size={14} color={palette.textPrimary} strokeWidth={1.9} />
            </View>
            <View style={styles.placeText}>
              <Text style={styles.placeLabel}>Destination</Text>
              <Text style={styles.placeValue}>{job.destinationAddress}</Text>
            </View>
          </View>
        ) : null}
        {job.notes ? <Row label="Notes" value={job.notes} /> : null}

        <SectionHead title="Earnings" />
        <Row label="Customer pays" value={money(job.totalAmount)} />
        <Row label="Platform fee" value={money(job.platformFee)} />
        <Row label="You earn" value={money(job.driverEarning)} />

        {job.status === 'ARRIVED' ? (
          <>
            <SectionHead title="Start trip" />
            <Text style={styles.helper}>
              Ask the customer for the 6-digit start code. It confirms the right
              driver and vehicle before the trip begins.
            </Text>
            <TextInput
              value={otp}
              onChangeText={(value) => {
                setOtp(value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              placeholder="6-digit code"
              placeholderTextColor={palette.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel="Start code"
              style={styles.otp}
            />
            <Button
              title="Start trip"
              onPress={() =>
                void run(async () => {
                  await verifyOtp.mutateAsync({ id: job.id, code: otp });
                  setOtp('');
                })
              }
              // 6 digits; 4 only for codes issued before the upgrade.
              disabled={(otp.length !== 6 && otp.length !== 4) || pending}
              loading={verifyOtp.isPending}
            />
          </>
        ) : null}

        {job.status === 'COMPLETED' ? (
          <View style={styles.completeNote}>
            <Text style={styles.completeTitle}>Trip completed</Text>
            <Text style={styles.completeBody}>
              {money(job.driverEarning)} will be included in your next payout.
            </Text>
          </View>
        ) : null}

        {job.status === 'CANCELLED' ? (
          <View style={styles.completeNote}>
            <Text style={styles.completeTitle}>Trip cancelled</Text>
            <Text style={styles.completeBody}>
              {job.cancellationReason ?? 'No reason provided.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {job.status === 'REQUESTED' ? (
            <ButtonRow>
              <Button
                title="Decline"
                variant="secondary"
                onPress={() => void decline()}
                disabled={pending}
                style={styles.flex}
              />
              <Button
                title="Accept trip"
                onPress={() => void accept()}
                loading={acceptJob.isPending}
                disabled={pending}
                style={styles.flex}
              />
            </ButtonRow>
          ) : null}

          {step && job.status !== 'ARRIVED' ? (
            <Button title={step.title} onPress={() => void advance()} loading={updateStatus.isPending} />
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  headMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.md },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  personText: { flex: 1 },
  personName: { ...typography.bodyMedium, color: palette.textPrimary },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  phone: { ...typography.caption, color: palette.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowLabel: { ...typography.label, color: palette.textMuted },
  rowValue: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  placeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoftBg,
  },
  placeText: { flex: 1 },
  placeLabel: { ...typography.label, color: palette.textMuted },
  placeValue: { ...typography.body, color: palette.textPrimary, marginTop: 2 },
  mapButton: { minHeight: 44, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  helper: { ...typography.caption, color: palette.textSecondary },
  otp: {
    minHeight: 52,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    fontFamily: fontFamilyMono,
    fontSize: 22,
    letterSpacing: 8,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  completeNote: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  completeTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  completeBody: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  actions: { marginTop: spacing.xl },
  flex: { flex: 1 },
});
