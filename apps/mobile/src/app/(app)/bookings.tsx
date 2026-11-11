import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBookings, type Booking } from '@/hooks/useBookings';
import {
  ScreenContainer,
  PressableScale,
  SectionHead,
  StatusPill,
  Skeleton,
  Button,
} from '@/components/ui';
import {
  palette,
  spacing,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { bookingStatusTone, formatDate, labelize } from '@/utils/format';

/**
 * Bookings — transactional list. Grouped Upcoming / Past, job-sheet rows,
 * no advertising (money and service state live here; an ad would undercut it).
 */

const PAST = new Set(['COMPLETED', 'CANCELLED']);

function amount(booking: Booking): string | null {
  if (!booking.payment) return null;
  return `₹${Number(booking.payment.amount).toLocaleString('en-IN')}`;
}

function BookingRow({
  booking,
  divider,
  onPress,
}: {
  booking: Booking;
  divider: boolean;
  onPress: () => void;
}) {
  const value = amount(booking);
  const when = formatDate(booking.scheduledAt ?? booking.createdAt);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.provider?.businessName ?? 'Booking'}, ${labelize(
        booking.status
      )}${value ? `, ${value}` : ''}`}
      scaleTo={0.99}
      style={[styles.row, divider && styles.divider]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowKicker}>
          {when}
          {value ? ` · ${value}` : ''}
        </Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {booking.provider?.businessName ?? 'Booking'}
        </Text>
        {booking.payment ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            Payment {labelize(booking.payment.status).toLowerCase()}
          </Text>
        ) : null}
      </View>
      <StatusPill
        label={labelize(booking.status)}
        tone={
          booking.status === 'CONFIRMED' || booking.status === 'PROVIDER_EN_ROUTE'
            ? 'neutral'
            : bookingStatusTone(booking.status)
        }
      />
    </PressableScale>
  );
}

export default function BookingsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useBookings();

  const bookings = data?.items ?? [];
  const upcoming = bookings.filter((b) => !PAST.has(b.status));
  const past = bookings.filter((b) => PAST.has(b.status));

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.textSecondary} />
        }
      >
        <Text style={styles.eyebrow}>Activity</Text>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.summary}>
          {bookings.length === 0
            ? 'No bookings yet'
            : `${upcoming.length} active · ${past.length} past`}
        </Text>

        {isLoading ? (
          <View style={styles.loading}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.rowText}>
                  <Skeleton width={90} height={11} />
                  <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
                  <Skeleton width="40%" height={11} style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        ) : isError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not load bookings</Text>
            <Text style={styles.emptyBody}>Check your connection and try again.</Text>
            <Button title="Retry" onPress={() => void refetch()} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyBody}>
              Accept a quote from a verified garage and your booking appears here.
            </Text>
            <Button title="Post a request" onPress={() => router.push('/requests/create')} />
          </View>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <SectionHead index="01" title="Upcoming" />
            ) : null}
            {upcoming.length > 0 ? (
              <View style={styles.list}>
                {upcoming.map((booking, i) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    divider={i > 0}
                    onPress={() => router.push(`/booking/${booking.id}`)}
                  />
                ))}
              </View>
            ) : null}

            {past.length > 0 ? (
              <SectionHead index={upcoming.length > 0 ? '02' : '01'} title="Past" />
            ) : null}
            {past.length > 0 ? (
              <View style={styles.list}>
                {past.map((booking, i) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    divider={i > 0}
                    onPress={() => router.push(`/booking/${booking.id}`)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
  eyebrow: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.3,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  summary: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  loading: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowText: { flex: 1 },
  rowKicker: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 3 },
  rowMeta: { ...typography.label, color: palette.textSecondary, marginTop: 2 },
  empty: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.heading, color: palette.textPrimary },
  emptyBody: {
    ...typography.caption,
    color: palette.textSecondary,
    maxWidth: 300,
    marginBottom: spacing.sm,
  },
});
