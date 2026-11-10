import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Bell,
  ChevronRight,
  ClipboardCheck,
  Fuel,
  LifeBuoy,
  MapPin,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useAddresses, useVehicles } from '@/hooks/useProfile';
import { useParts } from '@/hooks/useParts';
import { useNotifications } from '@/hooks/useNotifications';
import {
  ScreenContainer,
  EmptyState,
  SectionCard,
  ListItem,
  StatusPill,
  AdBanner,
  PressableScale,
  Section,
  Surface,
  MetallicEdge,
  RadialGlow,
  BottomFade,
} from '@/components/ui';
import { StatusTone, palette, spacing, radii, typography } from '@/theme';
import { carPhotoFor } from '@/lib/photos';
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

/** WEYRO-owned hero plate (night garage, graphite sedan, orange rim light). */
const HERO_IMAGE = require('../../../assets/images/hero-primary.jpg');

const CATEGORIES = [
  { key: 'REPAIR', label: 'Repair', Icon: Wrench },
  { key: 'MAINTENANCE', label: 'Maintenance', Icon: Settings2 },
  { key: 'SPARE_PART', label: 'Spare parts', Icon: Package },
  { key: 'TOWING', label: 'Towing', Icon: Truck },
  { key: 'ROADSIDE', label: 'Roadside', Icon: LifeBuoy },
  { key: 'INSPECTION', label: 'Inspection', Icon: ClipboardCheck },
];

const ROADSIDE = [
  { key: 'BATTERY', label: 'Battery', Icon: BatteryCharging },
  { key: 'TYRE', label: 'Tyre', Icon: LifeBuoy },
  { key: 'FUEL', label: 'Fuel', Icon: Fuel },
  { key: 'TOW', label: 'Tow', Icon: Truck },
];

const GUARANTEE = [
  { label: 'Verified providers', Icon: BadgeCheck },
  { label: 'Photo-based quotes', Icon: ShieldCheck },
  { label: 'Secure escrow', Icon: Sparkles },
];

const PACKAGES = [
  {
    title: 'Standard service',
    blurb: 'Oil, filters and a 30-point safety check',
    category: 'MAINTENANCE',
  },
  {
    title: 'AC service',
    blurb: 'Cooling check, gas top-up and cabin filter',
    category: 'MAINTENANCE',
  },
  {
    title: 'Pre-purchase inspection',
    blurb: '200-point check before you buy',
    category: 'INSPECTION',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, role } = useAuth();

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  const vehiclesQuery = useVehicles();
  const addressesQuery = useAddresses();
  const partsQuery = useParts({ limit: 8 });
  const { unreadCount, refetch: refetchNotifications } = useNotifications();

  const refetchAll = useCallback(async () => {
    await Promise.all([
      requestsQuery.refetch(),
      bookingsQuery.refetch(),
      vehiclesQuery.refetch(),
      refetchNotifications(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refetchAll();
    }, [refetchAll])
  );

  const requests = (requestsQuery.data?.items ?? []).slice(0, 2);
  const vehicles = (vehiclesQuery.data?.items ?? []).slice(0, 3);
  const parts = (partsQuery.data?.items ?? []).slice(0, 6);
  const address = addressesQuery.data?.addresses?.[0];
  const nextBooking = (bookingsQuery.data?.items ?? []).find(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );
  const loading = requestsQuery.isLoading || bookingsQuery.isLoading || vehiclesQuery.isLoading;
  const firstName =
    user?.customerProfile?.firstName ||
    (user?.email ? user.email.split('@')[0] : 'there');

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const heroParallax = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 420], [0, 140], Extrapolation.CLAMP),
      },
      { scale: 1.12 },
    ],
  }));

  if (role === 'ADMIN') {
    return (
      <ScreenContainer chrome="dark">
        <EmptyState
          title="Nothing here yet"
          message="The admin dashboard stays on the Overview tab."
        />
      </ScreenContainer>
    );
  }

  if (role === 'PROVIDER' || role === 'BOTH') {
    return <ProviderDashboard />;
  }

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        {/* ── Cinematic hero ─────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Animated.View style={[styles.heroImageWrap, heroParallax]}>
            <Image
              source={HERO_IMAGE}
              style={styles.heroImage}
              contentFit="cover"
              contentPosition="right"
              transition={250}
            />
          </Animated.View>
          <View style={styles.heroShade} />
          <RadialGlow size={340} opacity={0.12} style={styles.heroGlow} />
          <View style={styles.heroSketch} pointerEvents="none">
            <PorscheSketch911 opacity={0.1} strokeWidth={2.5} />
          </View>

          <View style={styles.heroInner}>
            <View style={styles.brandRow}>
              <Image
                source={require('../../../assets/images/weyro-logo.png')}
                style={styles.logoSmall}
                contentFit="contain"
              />
              <View style={styles.brandActions}>
                <PressableScale
                  onPress={() => router.push('/notifications')}
                  accessibilityRole="button"
                  accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                  scaleTo={0.9}
                  style={styles.iconButton}
                >
                  <Bell size={18} color={palette.onHeader} strokeWidth={1.8} />
                  {unreadCount > 0 ? <View style={styles.badge} /> : null}
                </PressableScale>
                <PressableScale
                  onPress={() => router.push('/profile')}
                  accessibilityRole="button"
                  accessibilityLabel="Profile"
                  scaleTo={0.92}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {(firstName?.[0] || 'W').toUpperCase()}
                  </Text>
                </PressableScale>
              </View>
            </View>

            <Text style={styles.heroEyebrow}>Weyro · Premium care</Text>
            <Text style={styles.greeting}>Your garage,</Text>
            <Text style={styles.greetingName} numberOfLines={1}>
              {firstName}
            </Text>
            <Text style={styles.heroTagline}>Your vehicle, our priority.</Text>
          </View>
          <BottomFade height={110} />
        </View>

        {/* ── Page content ───────────────────────────────────────────── */}
        <View style={styles.sheet}>
          <Pressable
            onPress={() => router.push('/addresses')}
            accessibilityRole="button"
            accessibilityLabel="Change location"
            style={styles.locationRow}
          >
            <MapPin size={15} color={palette.accent} strokeWidth={2} />
            <Text style={styles.locationText} numberOfLines={1}>
              {address?.title || address?.address || 'Set your location'}
            </Text>
            <ChevronRight size={15} color={palette.textMuted} strokeWidth={2} />
          </Pressable>

          <PressableScale
            onPress={() => router.push('/shop')}
            accessibilityRole="button"
            accessibilityLabel="Search services and parts"
            scaleTo={0.99}
            style={styles.searchBar}
          >
            <Search size={17} color={palette.textMuted} strokeWidth={2} />
            <Text style={styles.searchText}>Search services &amp; parts</Text>
          </PressableScale>

          {/* Categories */}
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(({ key, label, Icon }) => (
              <PressableScale
                key={key}
                onPress={() => router.push(`/requests/create?category=${key}`)}
                accessibilityRole="button"
                accessibilityLabel={label}
                scaleTo={0.95}
                style={styles.categoryTile}
              >
                <MetallicEdge style={styles.cardEdge} opacity={0.14} />
                <View style={styles.categoryIcon}>
                  <Icon size={21} color={palette.accent} strokeWidth={1.7} />
                </View>
                <Text style={styles.categoryLabel} maxFontSizeMultiplier={1.6}>
                  {label}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Roadside / SOS strip */}
          <Surface style={styles.roadside} radius={radii.lg}>
            <View style={styles.roadsideHead}>
              <View style={styles.tick} />
              <Text style={styles.roadsideTitle}>Need help now?</Text>
              <View style={{ flex: 1 }} />
              <PressableScale
                onPress={() => router.push('/sos')}
                accessibilityRole="link"
                accessibilityLabel="Open SOS"
                scaleTo={0.95}
              >
                <Text style={styles.roadsideLink}>SOS</Text>
              </PressableScale>
            </View>
            <View style={styles.roadsideRow}>
              {ROADSIDE.map(({ key, label, Icon }) => (
                <PressableScale
                  key={key}
                  onPress={() => router.push(`/sos?kind=${key}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} assistance`}
                  scaleTo={0.93}
                  style={styles.roadsideItem}
                >
                  <Icon size={19} color={palette.accent} strokeWidth={1.8} />
                  <Text style={styles.roadsideLabel}>{label}</Text>
                </PressableScale>
              ))}
            </View>
          </Surface>

          {/* Guarantee */}
          <View style={styles.guaranteeRow}>
            {GUARANTEE.map(({ label, Icon }) => (
              <View key={label} style={styles.guaranteeItem}>
                <Icon size={16} color={palette.textSecondary} strokeWidth={1.7} />
                <Text style={styles.guaranteeLabel} maxFontSizeMultiplier={1.5}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.adSlot}>
            <AdBanner placement="home-hero-bottom" />
          </View>

          {/* Garage */}
          <Section
            eyebrow="01 — Your garage"
            title="My vehicle"
            actionLabel={vehicles.length > 0 ? 'View all' : undefined}
            onAction={() => router.push('/vehicles')}
          >
            {loading ? (
              <View style={styles.garageSkeleton} />
            ) : vehicles.length === 0 ? (
              <PressableScale
                onPress={() => router.push('/vehicles')}
                accessibilityRole="button"
                accessibilityLabel="Add your vehicle"
                scaleTo={0.98}
                style={styles.addVehicle}
              >
                <Text style={styles.addVehicleText}>
                  Add your vehicle to start requesting repairs.
                </Text>
                <ChevronRight size={18} color={palette.textMuted} />
              </PressableScale>
            ) : (
              <PressableScale
                onPress={() => router.push(`/vehicles/${vehicles[0].id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${vehicles[0].make} ${vehicles[0].model}`}
                scaleTo={0.98}
                style={styles.vehicleCard}
              >
                <MetallicEdge style={styles.cardEdge} opacity={0.18} />
                <Image
                  source={{ uri: carPhotoFor(vehicles[0].make, vehicles[0].model) }}
                  style={styles.vehiclePhoto}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleTitle} numberOfLines={1}>
                    {vehicles[0].make} {vehicles[0].model}
                  </Text>
                  <Text style={styles.vehicleMeta} numberOfLines={1}>
                    {vehicles[0].registrationNumber} · {vehicles[0].year}
                  </Text>
                </View>
                <ChevronRight size={18} color={palette.textMuted} />
              </PressableScale>
            )}
          </Section>

          {/* Live activity */}
          <Section
            eyebrow="02 — Live"
            title="Active requests"
            actionLabel="View all"
            onAction={() => router.push('/requests/my')}
          >
            <SectionCard>
              {loading ? (
                <View style={styles.garageSkeleton} />
              ) : requests.length === 0 ? (
                <Text style={styles.emptyText}>
                  No requests yet — post one to get quotes.
                </Text>
              ) : (
                requests.map((request, index) => (
                  <ListItem
                    key={request.id}
                    bare
                    divider={index < requests.length - 1}
                    title={request.title}
                    subtitle={`${labelize(request.category)} · ${request.quotationsCount ?? 0} quotes`}
                    right={
                      <StatusPill
                        label={labelize(request.status)}
                        tone={requestTone(request.status)}
                      />
                    }
                    onPress={() => router.push(`/requests/${request.id}`)}
                    accessibilityLabel={`Request ${request.title}`}
                  />
                ))
              )}
            </SectionCard>
          </Section>

          <Section
            eyebrow="03 — Schedule"
            title="Next booking"
            actionLabel="View all"
            onAction={() => router.push('/bookings')}
          >
            <SectionCard>
              {loading ? (
                <View style={styles.garageSkeleton} />
              ) : nextBooking ? (
                <ListItem
                  bare
                  title={nextBooking.provider?.businessName ?? 'Booking'}
                  subtitle={[formatDate(nextBooking.scheduledAt), labelize(nextBooking.status)]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <StatusPill
                      label={labelize(nextBooking.status)}
                      tone={bookingTone(nextBooking.status)}
                    />
                  }
                  onPress={() => router.push(`/booking/${nextBooking.id}`)}
                  accessibilityLabel="Next booking"
                />
              ) : (
                <Text style={styles.emptyText}>No upcoming bookings.</Text>
              )}
            </SectionCard>
          </Section>

          {/* Parts */}
          {parts.length > 0 ? (
            <Section
              eyebrow="04 — Marketplace"
              title="Parts worth a look"
              actionLabel="Shop"
              onAction={() => router.push('/shop')}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.partsRow}
              >
                {parts.map((part) => (
                  <PressableScale
                    key={part.id}
                    onPress={() => router.push(`/shop/${part.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Part ${part.name}`}
                    scaleTo={0.96}
                    style={styles.partCard}
                  >
                    <Image
                      source={
                        part.imageUrl
                          ? { uri: part.imageUrl }
                          : require('../../../assets/images/hero-secondary.jpg')
                      }
                      style={styles.partImage}
                      contentFit="cover"
                      transition={150}
                    />
                    <Text style={styles.partName} numberOfLines={1}>
                      {part.name}
                    </Text>
                    <Text style={styles.partPrice}>
                      ₹{Number(part.price).toLocaleString('en-IN')}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Packages */}
          <Section eyebrow="05 — Services" title="Popular packages">
            <View style={styles.packages}>
              {PACKAGES.map((pkg) => (
                <PressableScale
                  key={pkg.title}
                  onPress={() =>
                    router.push(
                      `/requests/create?category=${pkg.category}&title=${encodeURIComponent(pkg.title)}`
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={pkg.title}
                  scaleTo={0.98}
                  style={styles.packageCard}
                >
                  <MetallicEdge style={styles.cardEdge} opacity={0.16} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packageTitle}>{pkg.title}</Text>
                    <Text style={styles.packageBlurb}>{pkg.blurb}</Text>
                  </View>
                  <View style={styles.packageCta}>
                    <ArrowRight size={16} color={palette.onAccent} strokeWidth={2.2} />
                  </View>
                </PressableScale>
              ))}
            </View>
          </Section>

          {/* Support */}
          <View style={styles.supportRow}>
            <PressableScale
              onPress={() => router.push('/sos')}
              accessibilityRole="button"
              accessibilityLabel="Roadside assistance"
              scaleTo={0.97}
              style={styles.supportCard}
            >
              <LifeBuoy size={20} color={palette.accent} strokeWidth={1.8} />
              <Text style={styles.supportTitle}>Roadside help</Text>
              <Text style={styles.supportMeta}>Battery · Tyre · Fuel · Tow</Text>
            </PressableScale>
            <PressableScale
              onPress={() => router.push('/help')}
              accessibilityRole="button"
              accessibilityLabel="Help and support"
              scaleTo={0.97}
              style={styles.supportCard}
            >
              <LifeBuoy size={20} color={palette.textSecondary} strokeWidth={1.8} />
              <Text style={styles.supportTitle}>Help &amp; support</Text>
              <Text style={styles.supportMeta}>FAQs · Bookings · Vehicles</Text>
            </PressableScale>
          </View>

          <Text style={styles.footer}>Weyro · Premium automotive care</Text>
        </View>
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: palette.header,
    paddingTop: 56,
    minHeight: 330,
    overflow: 'hidden',
  },
  heroImageWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroImage: { width: '100%', height: '100%' },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16, 18, 20, 0.42)',
  },
  heroGlow: { position: 'absolute', top: -50, right: -90 },
  heroSketch: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  brandActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoSmall: { height: 20, width: 72 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 18, 20, 0.55)',
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
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
  avatarText: { ...typography.label, color: palette.onAccent },
  heroEyebrow: {
    ...typography.label,
    color: palette.onHeaderMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  greeting: { ...typography.body, color: palette.onHeader },
  greetingName: {
    ...typography.display,
    color: palette.onHeader,
    fontWeight: '600',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  heroTagline: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: spacing.xs,
  },
  sheet: {
    marginTop: -20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: palette.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  locationText: { ...typography.captionMedium, color: palette.textPrimary, flexShrink: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.lg,
  },
  searchText: { ...typography.caption, color: palette.textMuted },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryTile: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  categoryLabel: { ...typography.label, color: palette.textSecondary, textAlign: 'center' },
  cardEdge: { position: 'absolute', top: 0, left: 0, right: 0 },
  roadside: { padding: spacing.md, marginBottom: spacing.lg },
  roadsideHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tick: { width: 2, height: 10, backgroundColor: palette.accent },
  roadsideTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  roadsideLink: { ...typography.label, color: palette.accent, letterSpacing: 1 },
  roadsideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  roadsideItem: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  roadsideLabel: { ...typography.label, color: palette.textSecondary },
  guaranteeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  guaranteeItem: { flex: 1, alignItems: 'center', gap: 4 },
  guaranteeLabel: {
    ...typography.label,
    color: palette.textMuted,
    textAlign: 'center',
    fontSize: 10,
  },
  adSlot: { marginTop: spacing.lg },
  garageSkeleton: {
    height: 64,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  addVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
  },
  addVehicleText: { ...typography.caption, color: palette.textSecondary, flex: 1 },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  vehiclePhoto: { width: 64, height: 48, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt },
  vehicleInfo: { flex: 1 },
  vehicleTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  vehicleMeta: { ...typography.label, color: palette.textSecondary, marginTop: 2 },
  emptyText: { ...typography.caption, color: palette.textMuted },
  partsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  partCard: {
    width: 148,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  partImage: {
    width: '100%',
    height: 82,
    borderRadius: radii.sm,
    backgroundColor: palette.surfaceAlt,
    marginBottom: spacing.sm,
  },
  partName: { ...typography.captionMedium, color: palette.textPrimary },
  partPrice: { ...typography.label, color: palette.accent, marginTop: 4 },
  packages: { gap: spacing.sm },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  packageTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  packageBlurb: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  packageCta: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  supportCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  supportTitle: { ...typography.captionMedium, color: palette.textPrimary },
  supportMeta: { ...typography.label, color: palette.textMuted },
  footer: {
    ...typography.label,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
