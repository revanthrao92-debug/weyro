import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Booking } from '@/hooks/useBookings';

export type BookingCardProps = {
  booking: Booking;
  onPress: (id: string) => void;
};

export function BookingCard({ booking, onPress }: BookingCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(booking.id)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Booking #{booking.id.slice(0, 8)}</Text>
        <StatusBadge status={booking.status} />
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
          <Text style={styles.amount}>
            ₹{booking.payment.amount.toLocaleString()}
          </Text>
          <Text style={styles.paymentStatus}>
            {booking.payment.status.charAt(0).toUpperCase() + booking.payment.status.slice(1)}
          </Text>
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{booking.status}</Text>
        <Text style={styles.meta}>
          {new Date(booking.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <Text style={[styles.badgeText, { color: color.text }]}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'CONFIRMED': return { bg: '#EFF6FF', text: '#208AEF' };
    case 'PROVIDER_EN_ROUTE': return { bg: '#FFF7ED', text: '#F59E0B' };
    case 'IN_PROGRESS': return { bg: '#EFF6FF', text: '#208AEF' };
    case 'COMPLETED': return { bg: '#ECFDF5', text: '#10B981' };
    case 'CANCELLED': return { bg: '#FEF2F2', text: '#EF4444' };
    case 'DISPUTED': return { bg: '#FDF4FF', text: '#8B5CF6' };
    default: return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
