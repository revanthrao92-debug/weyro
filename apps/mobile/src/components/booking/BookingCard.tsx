import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Booking } from '@/hooks/useBookings';
import { StatusPill } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export type BookingCardProps = {
  booking: Booking;
  onPress: (id: string) => void;
};

function statusTone(status: string) {
  switch (status) {
    case 'CONFIRMED':
    case 'PROVIDER_EN_ROUTE':
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    case 'DISPUTED':
      return 'warning';
    default:
      return 'neutral';
  }
}

function labelize(s: string) {
  return s.replace(/_/g, ' ');
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(booking.id)}
      accessibilityRole="button"
      accessibilityLabel={`Booking ${booking.id.slice(0, 8)}, ${labelize(booking.status)}`}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Booking #{booking.id.slice(0, 8)}</Text>
        <StatusPill label={labelize(booking.status)} tone={statusTone(booking.status)} />
      </View>

      {booking.provider && (
        <View style={styles.providerRow}>
          <Text style={styles.label}>Provider</Text>
          <Text style={styles.value}>{booking.provider.businessName}</Text>
        </View>
      )}

      {booking.payment && (
        <View style={styles.paymentRow}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountWrapper}>
            <Text style={styles.amount}>₹{booking.payment.amount.toLocaleString()}</Text>
            <StatusPill
              label={labelize(booking.payment.status)}
              tone={statusTone(booking.payment.status)}
            />
          </View>
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{labelize(booking.status)}</Text>
        <Text style={styles.meta}>{new Date(booking.createdAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  value: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  amount: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
