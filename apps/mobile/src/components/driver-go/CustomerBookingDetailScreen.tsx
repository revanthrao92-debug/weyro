import { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
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
  useCancelDriverBooking,
  useFetchStartCode,
  useMyDriverBooking,
} from '@/hooks/useDriverGoCustomer';
import { jobWhen, money } from '@/components/driver/driverFormat';
import { customerStatusLabel, customerStatusTone } from './format';
import {
  displayFamily,
  fontFamilyMono,
  palette,
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

export function CustomerBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = id ?? '';
  const router = useRouter();
  const query = useMyDriverBooking(bookingId);
  const cancel = useCancelDriverBooking();
  const startCode = useFetchStartCode(bookingId);

  const [code, setCode] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>BOOKING</Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.body}>
          <Skeleton width="55%" height={30} />
          <Skeleton width="100%" height={120} style={{ marginTop: spacing.lg }} />
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>BOOKING</Text>
          <View style={styles.spacer} />
        </View>
        <EmptyState
          title="Booking not found"
          message="This booking may have been removed."
        />
      </ScreenContainer>
    );
  }

  const booking = query.data;
  const vehicle = booking.vehicle;
  const initials = booking.driver.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(e?.message || 'Could not update the booking.');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.eyebrow}>BOOKING</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <StatusPill
          label={customerStatusLabel(booking.status)}
          tone={customerStatusTone(booking.status)}
        />
        <Text style={styles.title}>{jobWhen(booking.startAt)}</Text>
        <Text style={styles.subtitle}>
          {booking.engagement === 'HOURLY'
            ? `${booking.durationHours} hours`
            : `${booking.durationDays} day · 8 hours`}{' '}
          · {money(booking.totalAmount)}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {booking.status === 'REQUESTED' ? (
          <Text style={styles.notice}>
            Waiting for the driver to confirm. You’ll be notified when they
            accept.
          </Text>
        ) : null}

        <SectionHead index="01" title="Driver" />
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.driverText}>
            <Text style={styles.driverName}>{booking.driver.name}</Text>
            <View style={styles.ratingRow}>
              <Star size={12} color={palette.accent} strokeWidth={2} />
              <Text style={styles.rating}>
                {booking.driver.rating > 0
                  ? booking.driver.rating.toFixed(1)
                  : 'New driver'}
              </Text>
              <Text style={styles.driverMeta}>
                · {booking.driver.experienceYears} yrs ·{' '}
                {booking.driver.completedJobs}{' '}
                {booking.driver.completedJobs === 1 ? 'trip' : 'trips'}
              </Text>
            </View>
            <Text style={styles.driverMeta}>
              {booking.driver.languages.join(' · ')}
            </Text>
          </View>
        </View>

        <SectionHead index="02" title="Trip" />
        <Row label="Pickup" value={booking.pickupAddress} />
        <Row
          label="Start"
          value={`${jobWhen(booking.startAt)}`}
        />
        <Row
          label="Vehicle"
          value={
            vehicle
              ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`
              : 'Vehicle'
          }
        />
        {booking.notes ? <Row label="Notes" value={booking.notes} /> : null}

        {booking.status === 'ARRIVED' ? (
          <>
            <SectionHead index="03" title="Start code" />
            <Text style={styles.helper}>
              Share this 4-digit code with the driver. It confirms the right
              driver and starts the trip.
            </Text>
            {code ? (
              <View style={styles.codeBox}>
                <Text style={styles.code}>{code}</Text>
              </View>
            ) : (
              <Button
                title="Show start code"
                onPress={() =>
                  void run(async () => {
                    const result = await startCode.mutateAsync();
                    setCode(result.code);
                  })
                }
                loading={startCode.isPending}
              />
            )}
          </>
        ) : null}

        {booking.status === 'IN_PROGRESS' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Trip in progress</Text>
            <Text style={styles.noticeBody}>
              The driver has started your trip. Contact support if you need help.
            </Text>
          </View>
        ) : null}

        {booking.status === 'COMPLETED' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Trip completed</Text>
            <Text style={styles.noticeBody}>
              Thanks for using Driver Go. Reviews are coming in a later update.
            </Text>
          </View>
        ) : null}

        {booking.status === 'CANCELLED' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Booking cancelled</Text>
            <Text style={styles.noticeBody}>
              {booking.cancellationReason ?? 'No reason provided.'}
            </Text>
          </View>
        ) : null}

        <SectionHead
          index={booking.status === 'ARRIVED' ? '04' : '03'}
          title="Fare"
        />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(booking.totalAmount)}</Text>
        </View>
        <Text style={styles.helper}>
          Payment is arranged separately during the pilot.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Open pickup in Maps"
            variant="secondary"
            onPress={() =>
              void Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${booking.pickupLatitude},${booking.pickupLongitude}`,
              )
            }
          />
          <Button
            title="Contact support"
            variant="secondary"
            onPress={() =>
              void Linking.openURL(
                `mailto:support@weyro.app?subject=Driver%20Go%20booking%20${booking.id.slice(0, 8)}`,
              )
            }
          />

          {booking.canCancel ? (
            confirmingCancel ? (
              <View style={styles.cancelBox}>
                <Text style={styles.cancelTitle}>Cancel this booking?</Text>
                <Text style={styles.cancelBody}>
                  Free cancellation before the driver starts.
                </Text>
                <ButtonRow>
                  <Button
                    title="Keep booking"
                    variant="secondary"
                    onPress={() => setConfirmingCancel(false)}
                    style={styles.flex}
                  />
                  <Button
                    title="Cancel"
                    variant="destructive"
                    loading={cancel.isPending}
                    onPress={() =>
                      void run(async () => {
                        await cancel.mutateAsync(booking.id);
                        setConfirmingCancel(false);
                      })
                    }
                    style={styles.flex}
                  />
                </ButtonRow>
              </View>
            ) : (
              <Button
                title="Cancel booking"
                variant="destructive"
                onPress={() => setConfirmingCancel(true)}
              />
            )
          ) : null}
        </View>

        <Button
          title="All driver bookings"
          variant="secondary"
          onPress={() => router.replace('/driver-go/bookings')}
          style={styles.backCta}
        />
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
  },
  spacer: { width: 44 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 30,
    lineHeight: 34,
    color: palette.textPrimary,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  notice: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  noticeTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  noticeBody: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  driverRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  avatarText: { ...typography.bodyMedium, color: palette.textPrimary },
  driverText: { flex: 1 },
  driverName: { ...typography.bodyMedium, color: palette.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textPrimary,
  },
  driverMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
  row: {
    flexDirection: 'row',
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
  helper: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xs },
  codeBox: {
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
    alignItems: 'center',
  },
  code: {
    fontFamily: fontFamilyMono,
    fontSize: 34,
    letterSpacing: 10,
    color: palette.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  totalLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  totalValue: {
    fontFamily: fontFamilyMono,
    fontSize: 22,
    color: palette.textPrimary,
  },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  cancelBox: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoftBg,
  },
  cancelTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  cancelBody: { ...typography.caption, color: palette.textSecondary, marginTop: 2, marginBottom: spacing.md },
  flex: { flex: 1 },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.md },
  backCta: { marginTop: spacing.lg },
});
