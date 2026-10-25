import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ChevronRight, Wrench, Package, Truck, House } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useVehicles } from '@/hooks/useProfile';
import {
  ScreenContainer,
  AppHeader,
  EmptyState,
  SectionCard,
  ListItem,
  StatusPill,
  PromoBanner,
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

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=80';
const VEHICLE_IMAGE =
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=400&q=80';
const PROMO_IMAGE =
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd5?auto=format&fit=crop&w=800&q=80';

const QUICK_ACTIONS = [
  { label: 'Repair', Icon: Wrench, route: '/requests/create?category=REPAIR' },
  { label: 'Spare Parts', Icon: Package, route: '/shop' },
  { label: 'Towing', Icon: Truck, route: '/requests/create?category=TOWING' },
  { label: 'Home Mechanic', Icon: House, route: '/requests/create?category=ROADSIDE' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const insets = useSafeAreaInsets();

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  const vehiclesQuery = useVehicles();

  const [refreshing, setRefreshing] = useState(false);
  const [sponsoredVisible, setSponsoredVisible] = useState(true);

  const refetchAll = useCallback(async () => {
    await Promise.all([
      requestsQuery.refetch(),
      bookingsQuery.refetch(),
      vehiclesQuery.refetch(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const requests = (requestsQuery.data?.items ?? []).slice(0, 3);
  const vehicles = (vehiclesQuery.data?.items ?? []).slice(0, 3);
  const nextBooking = (bookingsQuery.data?.items ?? []).find(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );
  const loading = requestsQuery.isLoading || bookingsQuery.isLoading || vehiclesQuery.isLoading;
  const firstName =
    user?.customerProfile?.firstName ||
    (user?.email ? user.email.split('@')[0] : 'there');

  if (role !== 'CUSTOMER' && role !== null && role !== 'BOTH') {
    return (
      <ScreenContainer>
        <AppHeader
          logo={require('../../../assets/images/weyro-logo.png')}
          subtitle="Your vehicle, our priority."
        />
        <EmptyState
          title="Nothing here yet"
          message="Provider and admin dashboards are coming soon."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false} safeBottom>
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} />
        <View style={styles.heroShade} />
        <View style={styles.heroInner}>
          <View style={styles.brandRow}>
            <Pressable
              onPress={() => router.push('/(app)')}
              accessibilityRole="image"
              accessibilityLabel="Weyro"
            >
              <Image source={require('../../../assets/images/weyro-logo.png')} style={styles.logoSmall} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              className="active:opacity-60"
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {(firstName?.[0] || 'W').toUpperCase()}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
          <Text style={styles.heroTagline}>Your vehicle, our priority.</Text>
        </View>
      </View>

      <View style={styles.sheet}>
        {/* Primary service card */}
        <Pressable
          onPress={() => router.push('/service-selection')}
          accessibilityRole="button"
          accessibilityLabel="Request a Service"
          className="active:opacity-90"
          style={styles.requestCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.requestCardTitle}>Request a Service</Text>
            <Text style={styles.requestCardSubtitle}>
              Get quotes from verified mechanics and spare-parts dealers
            </Text>
          </View>
          <View style={styles.arrowCircle}>
            <ArrowRight size={20} color={palette.onAccent} strokeWidth={2.2} />
          </View>
        </Pressable>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map(({ label, Icon, route }) => (
            <Pressable
              key={label}
              onPress={() => router.push(route)}
              accessibilityRole="button"
              accessibilityLabel={label}
              className="active:opacity-60"
              style={styles.quickItem}
            >
              <View style={styles.quickCircle}>
                <Icon size={22} color={palette.teal} strokeWidth={1.75} />
              </View>
              <Text style={styles.quickLabel} maxFontSizeMultiplier={2}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* My Garage */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Garage</Text>
          <Pressable onPress={() => router.push('/vehicles')} accessibilityRole="link" className="active:opacity-60">
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={[styles.garageCard, styles.skeletonRow]} />
        ) : vehicles.length === 0 ? (
          <Pressable
            onPress={() => router.push('/vehicles')}
            accessibilityRole="button"
            accessibilityLabel="Add your vehicle"
            className="active:opacity-70"
            style={[styles.garageCard, styles.garageEmpty]}
          >
            <Text style={styles.garageEmptyText}>Add your vehicle to start requesting repairs.</Text>
            <ChevronRight size={18} color={palette.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(`/vehicles/${vehicles[0].id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${vehicles[0].make} ${vehicles[0].model}`}
            className="active:opacity-90"
            style={styles.garageCard}
          >
            <Image source={VEHICLE_IMAGE} style={styles.garageThumb} contentFit="cover" />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.garageTitle}>
                {vehicles[0].make} {vehicles[0].model}
              </Text>
              <Text style={styles.garageMeta}>
                {vehicles[0].registrationNumber} · {vehicles[0].year}
              </Text>
            </View>
            <ChevronRight size={20} color={palette.textMuted} />
          </Pressable>
        )}

        {/* Promotional placement */}
        <Pressable
          onPress={() => router.push('/shop')}
          accessibilityRole="button"
          accessibilityLabel="Genuine Parts offer"
          className="active:opacity-90"
          style={styles.promoCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>Genuine Parts. Better Rides.</Text>
            <Text style={styles.promoSubtitle}>Original parts from trusted dealers.</Text>
          </View>
          <Image source={PROMO_IMAGE} style={styles.promoImage} contentFit="cover" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Requests</Text>
          <Pressable onPress={() => router.push('/requests/my')} accessibilityRole="link" className="active:opacity-60">
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        <SectionCard style={styles.section}>
          {loading ? (
            <>
              <View style={styles.skeletonRow} />
              <View style={styles.skeletonRow} />
            </>
          ) : requests.length === 0 ? (
            <Pressable
              onPress={() => router.push('/requests/create')}
              accessibilityRole="button"
              accessibilityLabel="Create request"
              className="active:opacity-70"
              style={styles.emptyRow}
            >
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                No requests yet — post one to get quotes.
              </Text>
              <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
            </Pressable>
          ) : (
            requests.map((request, index) => (
              <ListItem
                key={request.id}
                bare
                divider={index < requests.length - 1}
                title={request.title}
                subtitle={labelize(request.category)}
                right={<StatusPill label={labelize(request.status)} tone={requestTone(request.status)} />}
                onPress={() => router.push(`/requests/${request.id}`)}
                accessibilityLabel={`Request ${request.title}`}
              />
            ))
          )}
        </SectionCard>

        {/* Sponsored placement (mid-feed ad slot, labeled) */}
        <PromoBanner
          image="https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80"
          headline="Trusted Parts. Verified Dealers."
          subhead="Explore sponsored offers from WEYRO partners."
          ctaLabel="Explore Offer"
          onPress={() => router.push('/shop')}
          sponsored
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Next Booking</Text>
          <Pressable onPress={() => router.push('/bookings')} accessibilityRole="link" className="active:opacity-60">
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        <SectionCard>
          {loading ? (
            <View style={styles.skeletonRow} />
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
              accessibilityLabel="View bookings"
              className="active:opacity-70"
              style={styles.emptyRow}
            >
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                No upcoming bookings.
              </Text>
              <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
            </Pressable>
          )}
        </SectionCard>
      </View>

    </ScreenContainer>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: palette.headerAlt,
    paddingTop: 24,
  },
  heroImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  heroShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(3, 18, 23, 0.72)' },
  heroInner: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  logoSmall: { height: 20, width: 72, resizeMode: 'contain' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.label,
    color: palette.onAccent,
    fontWeight: '700',
  },
  greeting: {
    ...typography.body,
    color: palette.onHeader,
  },
  greetingName: {
    ...typography.display,
    color: palette.onHeader,
    fontWeight: '700',
    marginTop: 2,
  },
  heroTagline: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: spacing.xs,
  },

  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: palette.canvas,
    minHeight: 400,
  },

  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  requestCardTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  requestCardSubtitle: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  quickItem: { alignItems: 'center', flex: 1 },
  quickCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...typography.label,
    color: palette.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  link: {
    ...typography.captionMedium,
    color: palette.teal,
  },
  section: { marginBottom: spacing.lg },

  garageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.sm,
  },
  garageEmpty: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  garageEmptyText: {
    ...typography.body,
    color: palette.textMuted,
    flex: 1,
  },
  garageThumb: { width: 64, height: 44, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt },
  garageTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  garageMeta: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },

  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.header,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  promoTitle: { ...typography.bodyMedium, color: palette.onHeader },
  promoSubtitle: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: 2,
  },
  promoImage: { width: 88, height: 60, borderRadius: radii.sm },

  skeletonRow: { height: 44, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt, marginBottom: spacing.sm },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: palette.textMuted,
    flex: 1,
    marginRight: spacing.sm,
  },
});
