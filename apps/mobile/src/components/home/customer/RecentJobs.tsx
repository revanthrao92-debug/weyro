import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { useRouter } from 'expo-router';
import { PressableScale, SectionHead, StatusPill } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { bookingStatusTone, formatDate, labelize } from '@/utils/format';
import type { Booking } from '@/hooks/useBookings';

/** Your last few finished or cancelled jobs, newest first. Hidden when there are none. */
export function RecentJobs({ router, bookings }: {
  router: ReturnType<typeof useRouter>;
  bookings: Booking[];
}) {
  const past = bookings.filter((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED').slice(0, 3);
  if (past.length === 0) return null;

  return (
    <View>
      <SectionHead title="Recent jobs" action="All bookings" onAction={() => router.push('/bookings')} />
      {past.map((booking, i) => (
        <PressableScale
          key={booking.id}
          onPress={() => router.push(`/booking/${booking.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${booking.quotation?.request?.title ?? 'Job'}, ${labelize(booking.status)}`}
          scaleTo={0.99}
          style={[styles.row, i > 0 && styles.divider]}
        >
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {booking.quotation?.request?.title ?? booking.provider?.businessName ?? 'Job'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[booking.provider?.businessName, formatDate(booking.completedAt ?? booking.scheduledAt)]
                .filter(Boolean)
                .join(', ')}
            </Text>
          </View>
          <StatusPill label={labelize(booking.status)} tone={bookingStatusTone(booking.status)} />
          <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 64, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  text: { flex: 1 },
  title: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
});
