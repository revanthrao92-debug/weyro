import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useVehicles } from '@/hooks/useProfile';
import {
  ScreenContainer,
  AppHeader,
  SectionHeader,
  ListItem,
  StatusPill,
  Skeleton,
  ButtonRow,
  Button,
  EmptyState,
} from '@/components/ui';
import { StatusTone, palette, spacing, typography } from '@/theme';

function requestTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN':
    case 'QUOTES_RECEIVED':
      return 'info';
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function bookingTone(status: string): StatusTone {
  switch (status) {
    case 'CONFIRMED':
    case 'PROVIDER_EN_ROUTE':
      return 'info';
    case 'IN_PROGRESS':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'DISPUTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function labelize(value: string) {
  return value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Placeholder dashboard for provider/admin (their dashboards are backlog). */
const PROVIDER_COPY: Record<string, { title: string; subtitle: string; message: string }> = {
  ADMIN: {
    title: 'Overview',
    subtitle: 'Platform at a glance',
    message: 'Verifications, escrow and platform activity will surface here.',
  },
  PROVIDER: {
    title: 'Dashboard',
    subtitle: 'Your workshop at a glance',
    message: 'Nearby requests, jobs and earnings will surface here.',
  },
  BOTH: {
    title: 'Dashboard',
    subtitle: 'Your workshop at a glance',
    message: 'Nearby requests, jobs and earnings will surface here.',
  },
};

export default function HomeScreen() {
  const { role } = useAuth();
  const router = useRouter();

  const placeholder = PROVIDER_COPY[role ?? ''];

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  const vehiclesQuery = useVehicles();

  if (placeholder) {
    return (
      <ScreenContainer>
        <AppHeader title={placeholder.title} subtitle={placeholder.subtitle} />
        <EmptyState title="Nothing here yet" message={placeholder.message} />
      </ScreenContainer>
    );
  }

  const requests = (requestsQuery.data?.items ?? []).slice(0, 3);
  const nextBooking = (bookingsQuery.data?.items ?? []).find(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );
  const vehicles = (vehiclesQuery.data?.items ?? []).slice(0, 3);

  const loading = requestsQuery.isLoading || bookingsQuery.isLoading || vehiclesQuery.isLoading;

  return (
    <ScreenContainer>
      <AppHeader title="Home" subtitle="Your garage at a glance" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Quick actions */}
        <ButtonRow>
          <Button
            title="Create request"
            onPress={() => router.push('/requests/create')}
            style={styles.flex}
          />
          <Button
            title="My requests"
            variant="secondary"
            onPress={() => router.push('/requests/my')}
            style={styles.flex}
          />
        </ButtonRow>
        <View style={styles.rowGap} />
        <ButtonRow>
          <Button
            title="Shop parts"
            variant="secondary"
            onPress={() => router.push('/shop')}
            style={styles.flex}
          />
          <Button
            title="Messages"
            variant="secondary"
            onPress={() => router.push('/messages')}
            style={styles.flex}
          />
        </ButtonRow>

        {/* Active requests */}
        <SectionHeader
          title="Active requests"
          actionLabel="See all"
          onAction={() => router.push('/requests/my')}
        />
        {loading ? (
          <View>
            <Skeleton width="100%" height={56} />
            <View style={styles.rowGap} />
            <Skeleton width="100%" height={56} />
          </View>
        ) : requests.length === 0 ? (
          <Text style={styles.emptyText}>No requests yet — post one to get quotes.</Text>
        ) : (
          requests.map((request) => (
            <ListItem
              key={request.id}
              title={request.title}
              subtitle={`${labelize(request.category)} · ${request.address}`}
              right={<StatusPill label={labelize(request.status)} tone={requestTone(request.status)} />}
              onPress={() => router.push(`/requests/${request.id}`)}
              accessibilityLabel={`Request ${request.title}`}
            />
          ))
        )}

        {/* Next booking */}
        <SectionHeader
          title="Next booking"
          actionLabel="See all"
          onAction={() => router.push('/bookings')}
        />
        {loading ? (
          <Skeleton width="100%" height={56} />
        ) : nextBooking ? (
          <ListItem
            title={nextBooking.provider?.businessName ?? 'Booking'}
            subtitle={[formatDate(nextBooking.scheduledAt), labelize(nextBooking.status)]
              .filter(Boolean)
              .join(' · ')}
            right={<StatusPill label={labelize(nextBooking.status)} tone={bookingTone(nextBooking.status)} />}
            onPress={() => router.push(`/booking/${nextBooking.id}`)}
            accessibilityLabel="Next booking"
          />
        ) : (
          <Text style={styles.emptyText}>No upcoming bookings.</Text>
        )}

        {/* Vehicles */}
        <SectionHeader
          title="My vehicles"
          actionLabel="Manage"
          onAction={() => router.push('/vehicles')}
        />
        {loading ? (
          <Skeleton width="100%" height={56} />
        ) : vehicles.length === 0 ? (
          <Text style={styles.emptyText}>Add your vehicle to start requesting repairs.</Text>
        ) : (
          vehicles.map((vehicle) => (
            <ListItem
              key={vehicle.id}
              title={`${vehicle.make} ${vehicle.model}`}
              subtitle={`${vehicle.year} · ${vehicle.registrationNumber}`}
              onPress={() => router.push('/vehicles')}
              accessibilityLabel={`Vehicle ${vehicle.make} ${vehicle.model}`}
            />
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  flex: { flex: 1 },
  rowGap: { height: spacing.sm },
  emptyText: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.sm,
  },
});
