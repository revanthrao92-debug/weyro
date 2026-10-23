import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBooking, useUpdateBookingStatus } from '@/hooks/useBookings';
import { CostBreakdown } from '@/components/booking/CostBreakdown';
import { TrackingMap } from '@/components/booking/TrackingMap';

type BookingDetailParams = { id: string };

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<BookingDetailParams>();
  const { data: booking, isLoading, isError } = useBooking(id || '');
  const updateStatus = useUpdateBookingStatus();

  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>Booking not found</Text>
      </View>
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
    // Placeholder: would integrate with location permissions and socket tracking
    Alert.alert(
      'Live Tracking',
      'Provider location tracking will appear here once the job is en route.'
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Booking #{booking.id.slice(0, 8)}</Text>
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusValue}>{booking.status.replace(/_/g, ' ')}</Text>
          </View>

          {booking.provider && (
            <View style={styles.providerRow}>
              <Text style={styles.sectionTitle}>Provider</Text>
              <Text style={styles.providerName}>{booking.provider.businessName}</Text>
              <Text style={styles.providerMeta}>
                {booking.provider.totalReviews} reviews • {booking.provider.completedJobs} jobs
              </Text>
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
        </View>

        {booking.payment && (
          <View style={styles.card}>
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
          </View>
        )}

        {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            <TrackingMap />
            <TouchableOpacity style={styles.trackButton} onPress={handleTrackLocation}>
              <Text style={styles.trackButtonText}>Refresh Provider Location</Text>
            </TouchableOpacity>
          </View>
        )}

        {canUpdate && nextStatus && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateStatus}>
              <Text style={styles.buttonText}>
                {booking.status === 'CONFIRMED' ? 'Mark En Route'
                  : booking.status === 'PROVIDER_EN_ROUTE' ? 'Mark In Progress'
                  : 'Mark Completed'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = {
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#208AEF',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  providerMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  paymentStatusLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentStatusValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  trackButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
} as any;
