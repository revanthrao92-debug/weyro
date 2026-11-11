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
import {
  MapPin,
  Navigation,
  Phone,
  UserRound,
} from 'lucide-react-native';
import {
  BackButton,
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
  vehicleLabel,
} from './driverFormat';
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
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>JOB</Text>
          <View style={styles.spacer} />
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
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>JOB</Text>
          <View style={styles.spacer} />
        </View>
        <EmptyState
          title="Job not found"
          message="This job may have been reassigned or cancelled."
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
      setError(e?.message || 'Could not update this job.');
    }
  };

  const accept = () => run(() => acceptJob.mutateAsync(job.id));
  const decline = () =>
    run(async () => {
      await declineJob.mutateAsync({ id: job.id });
      router.back();
    });

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.eyebrow}>JOB</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <StatusPill
            label={jobStatusLabel(job.status)}
            tone={jobStatusTone(job.status)}
          />
          <Text style={styles.title}>{jobWhen(job.startAt)}</Text>
          <Text style={styles.subtitle}>
            {durationLabel(job)} · {job.engagement === 'DAILY' ? 'Daily' : 'Hourly'}{' '}
            · {job.scheduleMode === 'ON_DEMAND' ? 'On demand' : 'Scheduled'}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SectionHead index="01" title="Customer" />
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

        <SectionHead index="02" title="Vehicle" />
        <Row label="Vehicle" value={vehicleLabel(job)} />
        <Row
          label="Transmission"
          value={job.vehicle?.transmission ?? job.transmission ?? 'Not specified'}
        />

        <SectionHead index="03" title="Route" />
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

        <SectionHead index="04" title="Earnings" />
        <Row label="Customer pays" value={money(job.totalAmount)} />
        <Row label="Platform fee" value={money(job.platformFee)} />
        <Row label="You earn" value={money(job.driverEarning)} />

        {job.status === 'ARRIVED' ? (
          <>
            <SectionHead index="05" title="Start trip" />
            <Text style={styles.helper}>
              Ask the customer for the 4-digit start code. It confirms the right
              driver and vehicle before the trip begins.
            </Text>
            <TextInput
              value={otp}
              onChangeText={(value) => {
                setOtp(value.replace(/\D/g, '').slice(0, 4));
                setError(null);
              }}
              placeholder="4-digit code"
              placeholderTextColor={palette.textMuted}
              keyboardType="number-pad"
              maxLength={4}
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
              disabled={otp.length !== 4 || pending}
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
            <Text style={styles.completeTitle}>Job cancelled</Text>
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
                title="Accept job"
                onPress={() => void accept()}
                loading={acceptJob.isPending}
                disabled={pending}
                style={styles.flex}
              />
            </ButtonRow>
          ) : null}

          {job.status === 'CONFIRMED' ? (
            <Button
              title="Start journey"
              onPress={() =>
                void run(() =>
                  updateStatus.mutateAsync({
                    id: job.id,
                    status: 'DRIVER_EN_ROUTE',
                  }),
                )
              }
              loading={updateStatus.isPending}
            />
          ) : null}

          {job.status === 'DRIVER_EN_ROUTE' ? (
            <Button
              title="I've arrived"
              onPress={() =>
                void run(() =>
                  updateStatus.mutateAsync({ id: job.id, status: 'ARRIVED' }),
                )
              }
              loading={updateStatus.isPending}
            />
          ) : null}

          {job.status === 'IN_PROGRESS' ? (
            <Button
              title="Complete trip"
              onPress={() =>
                void run(() =>
                  updateStatus.mutateAsync({ id: job.id, status: 'COMPLETED' }),
                )
              }
              loading={updateStatus.isPending}
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
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
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  spacer: { width: 44 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  head: { gap: spacing.xs, alignItems: 'flex-start' },
  title: { ...typography.title, color: palette.textPrimary, marginTop: spacing.xs },
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
  phone: { fontFamily: fontFamilyMono, fontSize: 10, color: palette.textMuted },
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
  mapButton: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12 },
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
