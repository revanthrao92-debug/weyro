import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Clock } from 'lucide-react-native';
import { PressableScale, StatusPill } from '@/components/ui';
import { jobWhen, money } from '@/components/driver/driverFormat';
import { customerStatusLabel, customerStatusTone } from './format';
import type { CustomerDriverBooking } from '@/hooks/useDriverGoCustomer';
import { fontFamilyMono, palette, radii, spacing, typography } from '@/theme';

function duration(booking: CustomerDriverBooking) {
  if (booking.engagement === 'DAILY') {
    const days = booking.durationDays ?? 1;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const hours = booking.durationHours ?? 2;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function CustomerBookingCard({
  booking,
  onPress,
}: {
  booking: CustomerDriverBooking;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${customerStatusLabel(booking.status)} Driver Go booking with ${booking.driver.name}, ${jobWhen(booking.startAt)}`}
      scaleTo={0.99}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.when}>
          <Clock size={13} color={palette.textMuted} strokeWidth={1.8} />
          <Text style={styles.whenText}>{jobWhen(booking.startAt)}</Text>
        </View>
        <StatusPill
          label={customerStatusLabel(booking.status)}
          tone={customerStatusTone(booking.status)}
        />
      </View>

      <Text style={styles.driver}>{booking.driver.name}</Text>
      <Text style={styles.pickup} numberOfLines={1}>
        {booking.pickupAddress}
      </Text>

      <View style={styles.bottom}>
        <Text style={styles.duration}>
          {duration(booking)} · {booking.engagement === 'DAILY' ? 'Daily' : 'Hourly'}
        </Text>
        <Text style={styles.total}>{money(booking.totalAmount)}</Text>
        <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  when: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  whenText: { fontFamily: fontFamilyMono, fontSize: 10, color: palette.textMuted },
  driver: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: spacing.sm },
  pickup: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  duration: {
    flex: 1,
    ...typography.label,
    color: palette.textSecondary,
  },
  total: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
