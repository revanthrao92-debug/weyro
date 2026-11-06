import { useCallback } from 'react';
import {
  FlatList,
 Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { UserRound, Bell, ArrowRight, ChevronRight, Package, Cog, CircleDot, Zap, Filter } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';
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
  StatusDot,
  AdBanner,
} from '@/components/ui';
import { StatusTone, palette, spacing, radii, typography, elevation } from '@/theme';
import { labelize, formatDate } from '@/utils/format';
import { BrandMark } from '@/components/art/BrandMark';

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
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1400&q=85';
const QUICK_ACTIONS = [
  { label: 'Post\nRequirement', Icon: Package, route: '/requests/create' },
  { label: 'Find Parts', Icon: Package, route: '/shop' },
  { label: 'Find Dealers', Icon: UserRound, route: '/(app)/provider-search' },
];

const CATEGORIES: { label: string; Icon: typeof CircleDot }[] = [
  { label: 'Brakes', Icon: CircleDot },
  { label: 'Engine', Icon: Cog },
  { label: 'Suspension', Icon: CircleDot },
  { label: 'Electrical', Icon: Zap },
  { label: 'Body Parts', Icon: Package },
  { label: 'Filters', Icon: Filter },
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
      {/* Layered scene: dawn service-bay photo, sketch overlay, type on the
          calm upper band. The garage card below rises over the hero edge. */}
      <View style={[styles.hero, { paddingTop: 48 }]}>
        <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} />
        <View style={styles.heroShade} />
        <View style={styles.heroInner}>
          <View style={styles.brandRow}>
            <BrandMark size="sm" />
            <Pressable
              onPress={() => router.push('/(app)/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              className="active:opacity-60"
              style={styles.bellBtn}
            >
              <Bell size={18} color={palette.onHeader} strokeWidth={1.8} />
              <View style={styles.bellDot} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/profile')}
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
          <Text style={styles.greeting}>Premium Auto Care</Text>
          <Text style={styles.greetingName}>Get the Right{'\n'}Part. Right Away.</Text>
          <Text style={styles.heroTagline}>Trusted dealers. Genuine parts.</Text>
        </View>
      </View>

      <View style={[styles.sheet, styles.sheetOverHero]}>
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


        {/* Popular categories — mock grid, real shop routing */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Categories</Text>
          <Pressable
            onPress={() => router.push('/(app)/shop')}
            accessibilityRole="link"
            className="active:opacity-60"
          >
            <Text style={styles.link}>View all →</Text>
          </Pressable>
        </View>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
          renderItem={({ item: c }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Browse ${c.label}`}
              onPress={() => router.push('/(app)/shop')}
              style={styles.catCard}
              className="active:opacity-80"
            >
              <View style={styles.catIcon}>
                <c.Icon size={20} color={palette.textSecondary} strokeWidth={1.75} />
              </View>
              <Text style={styles.catLabel} maxFontSizeMultiplier={2} numberOfLines={2}>
                {c.label}
              </Text>
            </Pressable>
          )}
        />

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
  heroShade: { position: 'absolute', inset: 0, backgroundColor: palette.scrim },
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
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: palette.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    marginTop: -radii.lg,
    minHeight: 400,
  },
  sheetOverHero: { zIndex: 2 },
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
  catRow: { gap: spacing.md, paddingRight: spacing.lg },
  catCard: {
    width: 100,
    height: 88,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: palette.accentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    ...typography.label,
    color: palette.textSecondary,
    textAlign: 'center',
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
