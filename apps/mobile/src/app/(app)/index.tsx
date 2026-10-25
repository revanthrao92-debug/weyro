import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Car, ChevronRight, ClipboardList, CalendarDays, Home, Package, Truck, Wrench } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useVehicles } from '@/hooks/useProfile';
import {
  ScreenContainer,
  AppHeader,
  SectionCard,
  ListItem,
  StatusPill,
  Skeleton,
  EmptyState,
  PromoBanner,
  Button,
  ButtonRow,
  Chip,
} from '@/components/ui';
import { StatusTone, palette, spacing, radii, typography } from '@/theme';

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

/** Premium automotive hero image (unsplash). */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80';

/** Promo placement — real ad inventory would be injected here. */
const PROMO_IMAGE =
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80';

/** Quick service shortcuts. */
const SERVICES = [
  { label: 'Repairs', icon: Wrench, tone: 'info' as const },
  { label: 'Spare Parts', icon: Package, tone: 'neutral' as const },
  { label: 'Towing', icon: Truck, tone: 'warning' as const },
  { label: 'Home Mechanic', icon: Home, tone: 'info' as const },
];

export default function HomeScreen() {
  const { role } = useAuth();
  const router = useRouter();

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  const vehiclesQuery = useVehicles();

  const [refreshing, setRefreshing] = useState(false);

  const refetchAll = useCallback(async () => {
    await Promise.all([
      requestsQuery.refetch(),
      bookingsQuery.refetch(),
      vehiclesQuery.refetch(),
    ]);
  }, []);

  // Refresh whenever the Home tab gains focus, so the dashboard is never stale.
  useFocusEffect(
    useCallback(() => {
      void refetchAll();
    }, [refetchAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  if (role !== 'CUSTOMER') {
    return (
      <ScreenContainer>
        <AppHeader logo={require('../../../assets/images/weyro-logo.png')} subtitle="Your garage at a glance" />
        <EmptyState
          title="Nothing here yet"
          message="Customer dashboard coming soon — switch to customer mode."
        />
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
      <AppHeader
        logo={require('../../../assets/images/weyro-logo.png')}
        subtitle="Your vehicle, our priority."
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero section */}
        <View style={styles.hero}>
          <Image
            source={{ uri: HERO_IMAGE }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <Text style={styles.heroGreeting}>Good morning, {role === 'CUSTOMER' ? 'Revanth' : 'Owner'}</Text>
              <Text style={styles.heroTitle}>Your vehicle, our priority.</Text>
              <Text style={styles.heroSubtitle}>
                Get quotes from verified workshops and spare-parts dealers near you.
              </Text>
              <Button
                title="Request a Service"
                onPress={() => router.push('/requests/create')}
                style={styles.heroButton}
              />
            </View>
          </View>
        </View>

        {/* Quick service shortcuts */}
        <SectionCard
          title="Quick services"
          icon={Car}
          style={styles.section}
        >
          <ButtonRow>
            {SERVICES.map((s) => (
              <Chip
                key={s.label}
                label={s.label}
                selected={false}
                onPress={() => router.push('/requests/create')}
              />
            ))}
          </ButtonRow>
        </SectionCard>

        {/* Promotional placement */}
        <PromoBanner
          image={PROMO_IMAGE}
          headline="Premium Parts. Trusted Service."
          subhead="Everything your vehicle needs, all in one place."
          ctaLabel="Explore Offer"
          onPress={() => router.push('/shop')}
          sponsorLabel="Sponsored"
          sponsored
        />

        {/* My Garage */}
        <SectionCard
          title="My Garage"
          icon={Car}
          count={vehicles.length || undefined}
          actionLabel="Manage"
          onAction={() => router.push('/vehicles')}
          onPress={() => router.push('/vehicles')}
          style={styles.section}
        >
          {loading ? (
            <View>
              <Skeleton width="100%" height={40} />
              <View style={styles.rowGap} />
              <Skeleton width="100%" height={40} />
            </View>
          ) : vehicles.length === 0 ? (
            <Pressable
              onPress={() => router.push('/vehicles')}
              accessibilityRole="button"
              accessibilityLabel="Add your vehicle"
              style={styles.emptyRow}
            >
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                Add your vehicle to start requesting repairs.
              </Text>
              <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
            </Pressable>
          ) : (
            vehicles.map((vehicle, index) => (
              <ListItem
                key={vehicle.id}
                bare
                divider={index < vehicles.length - 1}
                title={`${vehicle.make} ${vehicle.model}`}
                subtitle={`${vehicle.year} · ${vehicle.registrationNumber}`}
                onPress={() => router.push('/vehicles')}
                accessibilityLabel={`Vehicle ${vehicle.make} ${vehicle.model}`}
              />
            ))
          )}
        </SectionCard>

        {/* Active Requests */}
        <SectionCard
          title="Active Requests"
          icon={ClipboardList}
          count={requests.length || undefined}
          actionLabel="See all"
          onAction={() => router.push('/requests/my')}
          onPress={() => router.push('/requests/my')}
          style={styles.section}
        >
          {loading ? (
            <View>
              <Skeleton width="100%" height={40} />
              <View style={styles.rowGap} />
              <Skeleton width="100%" height={40} />
            </View>
          ) : requests.length === 0 ? (
            <Pressable
              onPress={() => router.push('/requests/create')}
              accessibilityRole="button"
              accessibilityLabel="Create request"
              style={styles.emptyRow}
            >
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                No requests yet — post one to get quotes.
              </Text>
              <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
            </Pressable>
          ) : (
            requests.map((request) => (
              <ListItem
                key={request.id}
                bare
                divider={false}
                title={request.title}
                subtitle={`${labelize(request.category)} · ${request.address}`}
                right={<StatusPill label={labelize(request.status)} tone={requestTone(request.status)} />}
                onPress={() => router.push(`/requests/${request.id}`)}
                accessibilityLabel={`Request ${request.title}`}
              />
            ))
          )}
        </SectionCard>

        {/* Next booking */}
        <SectionCard
          title="Next Booking"
          icon={CalendarDays}
          actionLabel="See all"
          onAction={() => router.push('/bookings')}
          onPress={() => router.push('/bookings')}
          style={styles.section}
        >
          {loading ? (
            <Skeleton width="100%" height={40} />
          ) : nextBooking ? (
            <ListItem
              bare
              title={nextBooking.provider?.businessName ?? 'Booking'}
              subtitle={[formatDate(nextBooking.scheduledAt), labelize(nextBooking.status)]
                .filter(Boolean)
                .join(' · ')}
              right={<StatusPill label={labelize(nextBooking.status)} tone={bookingTone(nextBooking.status)} />}
              onPress={() => router.push(`/booking/${nextBooking.id}`)}
              accessibilityLabel="Next booking"
            />
          ) : (
            <Pressable
              onPress={() => router.push('/bookings')}
              accessibilityRole="button"
              accessibilityLabel="Bookings"
              style={styles.emptyRow}
            >
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                No upcoming bookings.
              </Text>
              <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
            </Pressable>
          )}
        </SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.lg },
  rowGap: { height: spacing.sm },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: palette.textMuted,
    flex: 1,
  },

  // Hero
  hero: {
    height: 220,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: palette.surfaceAlt,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  heroContent: {
    paddingBottom: spacing.md,
  },
  heroGreeting: {
    ...typography.label,
    color: palette.accent,
    fontWeight: '600',
  },
  heroTitle: {
    ...typography.heading,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  heroSubtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  heroButton: {
    marginTop: spacing.md,
    width: '100%',
  },

  chip: {
    flex: 1,
  },
});
