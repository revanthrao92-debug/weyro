import {
  View,
  Text,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useBooking, useUpdateBookingStatus } from '@/hooks/useBookings';
import { CostBreakdown } from '@/components/booking/CostBreakdown';
import { TrackingMap } from '@/components/booking/TrackingMap';
import {
  ScreenContainer,
  AppHeader,
  Button,
  Card,
  StatusPill,
  Skeleton,
  EmptyState,
  BackButton,
} from '@/components/ui';
import { humanizeKey as labelize, bookingStatusTone as statusTone } from '@/utils/format';

/** Reference-screen step order; chained from booking mutation timestamps. */
const TIMELINE: { key: string; label: string }[] = [
  { key: 'CONFIRMED', label: 'Order Confirmed' },
  { key: 'IN_PROGRESS', label: 'Processing & Packaging' },
  { key: 'PROVIDER_EN_ROUTE', label: 'Out for Delivery' },
  { key: 'COMPLETED', label: 'Delivered' },
];
import { palette, spacing, typography, radii } from '@/theme';

type BookingDetailParams = { id: string };




export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<BookingDetailParams>();
  const { data: booking, isLoading, isError } = useBooking(id || '');
  const updateStatus = useUpdateBookingStatus();


  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader left={<BackButton />} title="Booking" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="60%" height={18} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={12} style={{ marginTop: spacing.sm }} />
          ))}
        </Card>
      </ScreenContainer>
    );
  }

  if (isError || !booking) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader left={<BackButton />} title="Booking" />
        <EmptyState
          title="Booking not found"
          message="This booking may have been removed."
        />
      </ScreenContainer>
    );
  }

  const canUpdate =
    booking.status === 'CONFIRMED' ||
    booking.status === 'PROVIDER_EN_ROUTE' ||
    booking.status === 'IN_PROGRESS';

  const nextStatus = (() => {
    switch (booking.status) {
      case 'CONFIRMED': return 'PROVIDER_EN_ROUTE';
      case 'PROVIDER_EN_ROUTE': return 'IN_PROGRESS';
      case 'IN_PROGRESS': return 'COMPLETED';
      default: return null;
    }
  })();

  const handleUpdateStatus = async () => {
    if (!nextStatus) return;
    try {
      await updateStatus.mutateAsync({
        id: booking.id,
        status: nextStatus,
        trackingNumber: undefined,
        carrierName: undefined,
      });
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to update status');
    }
  };

  const handleTrackLocation = () => {
    Alert.alert(
      'Live Tracking',
      'Provider location tracking will appear here once the job is en route.'
    );
  };


const BookingTimeline = ({ booking }: { booking: any }) => {
  const steps = TIMELINE.map((t) => ({ ...t, active: booking.status === t.key }));
  // "done" = everything before the current status index in the flow order
  const flowOrder = ['CONFIRMED', 'IN_PROGRESS', 'PROVIDER_EN_ROUTE', 'COMPLETED'];
  const currentIndex = flowOrder.indexOf(booking.status as string);
  const doneMap = flowOrder.reduce<Record<string, boolean>>((acc, key, i) => {
    acc[key] = currentIndex >= i && currentIndex >= 0;
    return acc;
  }, {});
  const timestamps: Record<string, string | undefined> = {
    CONFIRMED: booking.createdAt,
    IN_PROGRESS: booking.providerLocationUpdatedAt ?? booking.updatedAt,
    PROVIDER_EN_ROUTE: booking.providerLocationUpdatedAt,
    COMPLETED: booking.completedAt ?? (booking.status === 'COMPLETED' ? booking.updatedAt : undefined),
  };

  return (
    <View style={tlm.container}>
      {steps.map((step, i) => {
        const done = doneMap[step.key] ?? false;
        const isLast = i === steps.length - 1;
        const active = step.key === booking.status && booking.status !== 'COMPLETED';
        const time = timestamps[step.key];
        return (
          <View key={step.key}>
            <View style={tlm.row}>
              <View style={{ alignItems: 'center' }}>
                <View style={[tlm.dot, done && tlm.dotDone, active && tlm.dotActive]} />
                {!isLast && steps.length > 1 && (
                  <View style={[tlm.line, done && tlm.lineDone]} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[tlm.label, done && tlm.labelDone, active && tlm.labelActive]}>
                  {step.label}
                </Text>
                {time ? (
                  <Text style={tlm.time}>
                    {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : null}
                {active && step.key === 'PROVIDER_EN_ROUTE' ? (
                  <Text style={tlm.expected}>{'Expected: Today, 6 PM'}</Text>
                ) : null}
              </View>
              {active && step.key === 'PROVIDER_EN_ROUTE' ? (
                <Text style={{ fontSize: 18 }} accessibilityLabel="Out for delivery">
                  🚚
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const tlm = StyleSheet.create({
  container: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 44,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.textMuted,
    backgroundColor: palette.surface,
  },
  dotDone: { borderColor: palette.accent, backgroundColor: palette.accent },
  dotActive: { borderColor: palette.accent },
  line: { position: 'absolute', top: 22, bottom: -24, width: 2, backgroundColor: palette.border },
  lineDone: { backgroundColor: palette.accent },
  label: { ...typography.caption, color: palette.textMuted },
  labelDone: { color: palette.textPrimary },
  labelActive: { ...typography.captionMedium, color: palette.accent },
  time: { ...typography.label, color: palette.textSecondary },
  expected: { ...typography.label, color: palette.accent, marginTop: 2 },
});

const BookingTimelineBlock = ({ booking }: { booking: any }) => (
  <View style={tlmBlock.block}>
    <Text style={tlmBlock.title}>{'Track order timeline'}</Text>
    <BookingTimeline booking={booking} />
  </View>
);

const tlmBlock = StyleSheet.create({
  block: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  title: { ...typography.captionMedium, color: palette.textSecondary, marginBottom: spacing.sm },
});
  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader left={<BackButton />} title={`Booking #${booking.id.slice(0, 8)}`} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={styles.sectionTitle}>Status</Text>
          <BookingTimelineBlock booking={booking} />
        <View style={styles.statusRow}>
            <StatusPill
              label={labelize(booking.status)}
              tone={statusTone(booking.status)}
            />
          </View>

          {booking.provider && (
            <View style={styles.providerRow}>
              <Text style={styles.sectionTitle}>Provider</Text>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{booking.provider.businessName}</Text>
                <Text style={styles.providerMeta}>
                  {booking.provider.totalReviews} reviews • {booking.provider.completedJobs} jobs
                </Text>
              </View>
            </View>
          )}

          {booking.customer && (
            <View style={styles.customerRow}>
              <Text style={styles.sectionTitle}>Customer</Text>
              <Text style={styles.customerName}>
                {booking.customer.firstName} {booking.customer.lastName}
              </Text>
            </View>
          )}

          {booking.scheduledAt && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Scheduled</Text>
              <Text style={styles.metaValue}>
                {new Date(booking.scheduledAt).toLocaleString()}
              </Text>
            </View>
          )}
        </Card>

        {booking.payment && (
          <Card>
            <CostBreakdown
              parts={booking.payment.amount}
              labour={0}
              total={booking.payment.amount}
            />
            <View style={styles.paymentStatusRow}>
              <Text style={styles.paymentStatusLabel}>Payment</Text>
              <Text style={styles.paymentStatusValue}>
                {booking.payment.status.charAt(0).toUpperCase() + booking.payment.status.slice(1)}
              </Text>
            </View>
          </Card>
        )}

        {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
          <Card>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            <TrackingMap />
            <View style={styles.trackerActions}>
              <Button
                title="Refresh Provider Location"
                onPress={handleTrackLocation}
                variant="secondary"
              />
            </View>
          </Card>
        )}

        {canUpdate && nextStatus && (
          <View style={styles.actions}>
            <Button
              title={
                booking.status === 'CONFIRMED'
                  ? 'Mark En Route'
                  : booking.status === 'PROVIDER_EN_ROUTE'
                    ? 'Mark In Progress'
                    : 'Mark Completed'
              }
              onPress={handleUpdateStatus}
              variant="primary"
            />
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  sectionTitle: {
    ...typography.label,
    color: palette.textSecondary,
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusPill: {},
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  providerInfo: { flex: 1 },
  providerName: { ...typography.bodyMedium, color: palette.textPrimary },
  providerMeta: { ...typography.caption, color: palette.textSecondary },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  customerName: { ...typography.bodyMedium, color: palette.textPrimary },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metaLabel: { ...typography.caption, color: palette.textSecondary },
  metaValue: { ...typography.captionMedium, color: palette.textPrimary },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  paymentStatusLabel: { ...typography.caption, color: palette.textSecondary },
  paymentStatusValue: { ...typography.captionMedium, color: palette.success },
  trackerActions: { marginTop: spacing.md },
  actions: { marginTop: spacing.lg },
});
