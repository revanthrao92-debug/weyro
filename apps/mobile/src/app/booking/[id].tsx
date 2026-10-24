import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { palette, spacing, radii, typography } from '@/theme';

type BookingDetailParams = { id: string };

function labelize(s: string) {
  return s.replace(/_/g, ' ');
}

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

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<BookingDetailParams>();
  const { data: booking, isLoading, isError } = useBooking(id || '');
  const updateStatus = useUpdateBookingStatus();

  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  if (isLoading) {
    return (
      <ScreenContainer safeBottom padded={false}>
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
      <ScreenContainer safeBottom padded={false}>
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

  return (
    <ScreenContainer safeBottom padded={false}>
      <AppHeader left={<BackButton />} title={`Booking #${booking.id.slice(0, 8)}`} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={styles.sectionTitle}>Status</Text>
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
