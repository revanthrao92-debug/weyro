import { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooking, useUpdateBookingStatus } from '@/hooks/useBookings';
import {
  AppHeader,
  BackButton,
  Button,
  Card,
  EmptyState,
  Input,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { formatDate, titleize } from '@/utils/format';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
  type StatusTone,
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

function tone(status: string): StatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS' || status === 'PROVIDER_EN_ROUTE') return 'info';
  if (status === 'CANCELLED' || status === 'DISPUTED') return 'danger';
  return 'neutral';
}

export default function MechanicJobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking, isLoading, isError } = useBooking(id ?? '');
  const updateStatus = useUpdateBookingStatus();
  const [notes, setNotes] = useState('');

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
  const stepIndex = STEPS.indexOf(booking.status);
  const payment = booking.payment ?? booking.payments?.[0];

  const advance = async (status: string, withNotes = false) => {
    try {
      await updateStatus.mutateAsync({
        id: booking.id,
        status,
        ...(withNotes && notes.trim() ? { completionNotes: notes.trim() } : {}),
      });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update the job.');
    }
  };

  const onPrimary = () => {
    if (booking.status === 'CONFIRMED') return void advance('PROVIDER_EN_ROUTE');
    if (booking.status === 'PROVIDER_EN_ROUTE') return void advance('IN_PROGRESS');
    if (booking.status === 'IN_PROGRESS') {
      Alert.alert(
        'Complete job',
        'This marks the work complete and releases the held payment.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            onPress: () => void advance('COMPLETED', true),
          },
        ],
      );
    }
  };

  const primaryLabel =
    booking.status === 'CONFIRMED'
      ? 'On my way'
      : booking.status === 'PROVIDER_EN_ROUTE'
        ? 'Start job'
        : booking.status === 'IN_PROGRESS'
          ? 'Complete job'
          : null;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>Job</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {request?.title ?? 'Service job'}
        </Text>
        <View style={styles.metaRow}>
          <StatusPill label={statusLabel(booking.status)} tone={tone(booking.status)} />
          <Text style={styles.meta}>
            #{booking.id.slice(0, 8).toUpperCase()} · {titleize(request?.category ?? 'SERVICE')}
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.amount}>
            ₹{Number(booking.quotation?.totalCost ?? 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.meta}>
            {request?.address ?? 'Workshop job'}
            {booking.scheduledAt ? ` · ${formatDate(booking.scheduledAt)}` : ''}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.steps}>
            {STEPS.map((step, index) => {
              const done = stepIndex >= index && stepIndex >= 0;
              return (
                <View key={step} style={styles.step}>
                  <View style={[styles.dot, done && styles.dotDone]} />
                  <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
                    {statusLabel(step)}
                  </Text>
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

        {primaryLabel ? (
          <Card style={styles.card}>
            {booking.status === 'IN_PROGRESS' ? (
              <Input
                label="Completion notes (optional)"
                placeholder="Work done, parts replaced, next service"
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
          {request?.address ? (
            <Button
              title="Open in maps"
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
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Row
            label="Job value"
            value={`₹${Number(booking.quotation?.totalCost ?? 0).toLocaleString('en-IN')}`}
          />
          <Row
            label="Status"
            value={
              payment?.status
                ? payment.status.toLowerCase()
                : booking.status === 'COMPLETED'
                  ? 'released on completion'
                  : 'held in escrow'
            }
          />
          <Text style={styles.meta}>
            Funds release automatically when the job is marked complete. Payout
            settlement is not yet shown in the app.
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
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topBarSpacer: { width: 44 },
  eyebrow: { ...typography.label, color: palette.textMuted, letterSpacing: 0.3 },
  title: { ...typography.display, color: palette.textPrimary },
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
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.borderStrong,
  },
  dotDone: { backgroundColor: palette.accent },
  stepLabel: { ...typography.label, color: palette.textMuted },
  stepLabelDone: { color: palette.textPrimary },
  notes: { ...typography.caption, color: palette.textSecondary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: { ...typography.label, color: palette.textMuted },
  rowValue: {
    fontFamily: fontFamilyMono,
    fontSize: 12,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});
