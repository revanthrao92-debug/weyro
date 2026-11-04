import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, ChevronRight, Wrench, Package, Truck, House } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';
import { StatusDot } from '@/components/ui';
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
  AdBanner,
} from '@/components/ui';
import { StatusTone, palette, spacing, radii, typography, elevation } from '@/theme';
import { labelize, formatDate } from '@/utils/format';
import { PorscheSketch911 } from '@/components/art/PorscheSketch911';

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


const HERO_IMAGE =
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=80';
const VEHICLE_IMAGE =
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=400&q=80';

/**
 * Home hero art — REVERSIBILITY: flip HOME_HERO_MODE ('sketch' | 'photo').
 */
const HOME_HERO_MODE: 'sketch' | 'photo' = 'sketch';

const QUICK_ACTIONS = [
  { label: 'Repair', Icon: Wrench, route: '/requests/create?category=REPAIR' },
  { label: 'Spare Parts', Icon: Package, route: '/shop' },
  { label: 'Towing', Icon: Truck, route: '/requests/create?category=TOWING' },
  { label: 'Home Mechanic', Icon: House, route: '/requests/create?category=ROADSIDE' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, role } = useAuth();

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  const vehiclesQuery = useVehicles();

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

  const requests = (requestsQuery.data?.items ?? []).slice(0, 3);
  const vehicles = (vehiclesQuery.data?.items ?? []).slice(0, 3);
  const nextBooking = (bookingsQuery.data?.items ?? []).find(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );
  const loading = requestsQuery.isLoading || bookingsQuery.isLoading || vehiclesQuery.isLoading;
  const firstName =
    user?.customerProfile?.firstName ||
    (user?.email ? user.email.split('@')[0] : 'there');

  if (role === 'ADMIN') {
    return (
      <ScreenContainer chrome="dark">
        <AppHeader
          logo={require('../../../assets/images/weyro-logo.png')}
          subtitle="Your vehicle, our priority."
        />
        <EmptyState
          title="Nothing here yet"
          message="The admin dashboard stays on the Overview tab."
        />
      </ScreenContainer>
    );
  }

  // Checkpoint 3: real Dealer/Mechanic dashboard (photo-backed, rigid).
  if (role === 'PROVIDER' || role === 'BOTH') {
    return <ProviderDashboard />;
  }

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <View style={[styles.hero, { paddingTop: 48 }]}>
        {/* Hero art — REVERSIBILITY: flip HOME_HERO_MODE ('sketch' | 'photo'). */}
        {HOME_HERO_MODE === 'sketch' ? (
          <View style={styles.heroSketch} pointerEvents="none">
            <PorscheSketch911 opacity={0.18} strokeWidth={2.5} />
          </View>
        ) : (
          <>
            <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} />
            <View style={styles.heroShade} />
          </>
        )}
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
          <Text style={styles.greeting}>Your garage,</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
          <Text style={styles.heroTagline}>Your vehicle, our priority.</Text>
        </View>
      </View>

      <View style={styles.sheet}>
        {/* Sponsored slot directly under the hero — generous ad space */}
        <View style={styles.adSlot}>
          <AdBanner placement="home-hero-bottom" />
        </View>

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
              style={[styles.quickItem, elevation.card]}
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

        {/* Promotional placement is now the AdBanner slot above (single source) */}

        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusDot />
            <Text style={styles.sectionTitle}>Active requests</Text>
          </View>
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
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                No requests yet — post one to get quotes.
              </Text>
            </View>
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
        <View style={styles.adSlot}>
          <AdBanner placement="feed-inline" />
        </View>

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
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText} maxFontSizeMultiplier={2}>
                No upcoming bookings.
              </Text>
            </View>
          )}
        </SectionCard>
      </View>

    </ScreenContainer>
  );
}



const styles = StyleSheet.create({
  hero: {
    backgroundColor: palette.headerAlt,
    paddingTop: 24,
  },
  heroImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  heroSketch: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
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
    fontWeight: '600',
  },
  greeting: {
    ...typography.body,
    color: palette.onHeader,
  },
  greetingName: {
    ...typography.display,
    color: palette.onHeader,
    fontWeight: '600',
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
  adSlot: { marginBottom: spacing.lg },

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
  quickItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  quickCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.tealSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
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
