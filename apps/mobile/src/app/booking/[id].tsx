import {
  View,
  Text,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { titleize as labelize, bookingStatusTone as statusTone } from '@/utils/format';
import { palette, spacing, typography, radii, displayFamily, fontFamilyMono } from '@/theme';
import { useLocalSearchParams } from 'expo-router';
import { useBooking, useUpdateBookingStatus } from '@/hooks/useBookings';
import {
  ScreenContainer,
  Button,
  StatusPill,
  Skeleton,
  EmptyState,
  BackButton,
  FadeSlideIn,
  SectionHead,
} from '@/components/ui';

/** Reference-screen step order; chained from booking mutation timestamps. */
const TIMELINE: { key: string; label: string }[] = [
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PROVIDER_EN_ROUTE', label: 'Provider en route' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

type BookingDetailParams = { id: string };




export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<BookingDetailParams>();
  const { data: booking, isLoading, isError } = useBooking(id || '');
  const updateStatus = useUpdateBookingStatus();


  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <BackButton />
        <Skeleton width="55%" height={26} style={{ marginTop: spacing.md }} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={12} style={{ marginTop: spacing.md }} />
        ))}
      </ScreenContainer>
    );
  }

  if (isError || !booking) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <BackButton />
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

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.topLabel}>Booking</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={styles.title}>Booking #{booking.id.slice(0, 8)}</Text>
        <View style={styles.metaRow}>
          <StatusPill label={labelize(booking.status)} tone={statusTone(booking.status)} />
          <Text style={styles.date}>{new Date(booking.createdAt).toLocaleDateString()}</Text>
        </View>

        <SectionHead title="Progress" />
        <BookingTimeline booking={booking} />
        {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' ? (
          <>
            <RouteMapCard />
            <Text style={styles.note}>
              Live provider location is not available yet. The timeline updates as the
              status changes.
            </Text>
          </>
        ) : null}

        {booking.provider ? (
          <>
            <SectionHead title="Provider" />
            <View style={styles.spec}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Garage</Text>
                <Text style={styles.specValue}>{booking.provider.businessName}</Text>
              </View>
              <View style={[styles.specRow, styles.divider]}>
                <Text style={styles.specLabel}>Rating</Text>
                <Text style={styles.specValue}>
                  {Number(booking.provider.avgRating ?? 0).toFixed(1)} ·{' '}
                  {booking.provider.totalReviews} reviews
                </Text>
              </View>
              <View style={[styles.specRow, styles.divider]}>
                <Text style={styles.specLabel}>Completed jobs</Text>
                <Text style={styles.specValue}>{booking.provider.completedJobs}</Text>
              </View>
            </View>
          </>
        ) : null}

        <SectionHead title="Details" />
        <View style={styles.spec}>
          {booking.customer ? (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Customer</Text>
              <Text style={styles.specValue}>
                {booking.customer.firstName} {booking.customer.lastName}
              </Text>
            </View>
          ) : null}
          <View style={[styles.specRow, booking.customer ? styles.divider : undefined]}>
            <Text style={styles.specLabel}>Scheduled</Text>
            <Text style={styles.specValue}>
              {booking.scheduledAt
                ? new Date(booking.scheduledAt).toLocaleString()
                : 'Not scheduled'}
            </Text>
          </View>
          {booking.payment ? (
            <View style={[styles.specRow, styles.divider]}>
              <Text style={styles.specLabel}>Payment</Text>
              <Text style={styles.specValue}>
                ₹{Number(booking.payment.amount).toLocaleString('en-IN')} ·{' '}
                {labelize(booking.payment.status)}
              </Text>
            </View>
          ) : null}
        </View>

        {canUpdate && nextStatus ? (
          <View style={styles.actions}>
            <Button
              title={
                booking.status === 'CONFIRMED'
                  ? 'Mark en route'
                  : booking.status === 'PROVIDER_EN_ROUTE'
                    ? 'Mark in progress'
                    : 'Mark completed'
              }
              onPress={handleUpdateStatus}
              variant="primary"
            />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}


const BookingTimeline = ({ booking }: { booking: any }) => {
  const steps = TIMELINE.map((t) => ({ ...t, active: booking.status === t.key }));
  // "done" = everything before the current status index in the flow order
  const flowOrder = ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];
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
          <FadeSlideIn key={step.key} delay={i * 70}>
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
            </View>
          </FadeSlideIn>
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


const RouteMapCard = () => (
  <View style={mapCard.wrap}>
    {/* stylised route-path graphic panel (live maps dependency not present) */}
    <View style={mapCard.inner}>
      <View style={mapCard.bgLine} />
      <View style={mapCard.bgLine2} />
      <View style={mapCard.route} />
      <View style={[mapCard.pinStart]} />
      <View style={[mapCard.pinEnd]} />
    </View>
  </View>
);

const mapCard = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    overflow: 'hidden',
    height: 150,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inner: {
    ...{ width: '100%', height: '100%' },
    backgroundColor: palette.surfaceAlt,
    position: 'relative',
  },
  bgLine: { width: '100%', height: 1, backgroundColor: palette.border, position: 'absolute', top: 40 },
  bgLine2: { height: '100%', width: 1, backgroundColor: palette.border, position: 'absolute', left: 96 },
  route: {
    position: 'absolute',
    top: 70,
    left: 40,
    width: 180,
    height: 2,
    backgroundColor: palette.accent,
    transform: [{ rotate: '-12deg' }],
  },
  pinStart: {
    position: 'absolute',
    top: 66,
    left: 46,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.textPrimary,
  },
  pinEnd: {
    position: 'absolute',
    right: 24,
    top: 34,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.accent,
  },
});


const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topLabel: { ...typography.label, color: palette.textMuted },
  spacer: { width: 44 },
  title: {
    fontFamily: displayFamily,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: palette.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  date: { fontFamily: fontFamilyMono, fontSize: 11, color: palette.textMuted },
  note: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: spacing.sm,
  },
  spec: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  specLabel: { ...typography.caption, color: palette.textSecondary },
  specValue: {
    ...typography.captionMedium,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  actions: { marginTop: spacing.xl },
});
