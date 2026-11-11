import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  ChevronRight,
  Cog,
  Disc3,
  Filter,
  MapPin,
  Search,
  Settings2,
  Zap,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
import { HomeServiceSections } from '@/components/home/HomeServiceSections';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useAddresses, useReplaceAddresses, useVehicles } from '@/hooks/useProfile';
import { useParts } from '@/hooks/useParts';
import { useNotifications } from '@/hooks/useNotifications';
import {
  ScreenContainer,
  EmptyState,
  StatusPill,
  PressableScale,
  SideFade,
  AdSlot,
  SectionHead as Head,
} from '@/components/ui';
import {
  StatusTone,
  palette,
  spacing,
  radii,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { LocationPicker, type PickedLocation } from '@/maps';
import { carPhotoFor } from '@/lib/photos';
import { labelize, formatDate } from '@/utils/format';

/**
 * Home — rebuilt around the product: a service-bay hero, a job-sheet service
 * index, and live status rows. Quiet chrome, one accent, mono figures.
 */

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

const HERO_IMAGE = require('../../../assets/images/hero-primary.jpg');
// Workshop band: Unsplash (photo-1615906655593-ad0386982a0f), cropped + graded
// locally; Unsplash license allows commercial use without attribution.


/** Shop navigation categories — used when the catalogue has no listings yet. */
const PART_CATEGORIES = [
  { label: 'Brakes', detail: 'Pads, discs, fluid', Icon: Disc3 },
  { label: 'Filters', detail: 'Oil, air, cabin', Icon: Filter },
  { label: 'Batteries', detail: 'Start-stop, EFB, AGM', Icon: BatteryCharging },
  { label: 'Suspension', detail: 'Shocks, bushes, links', Icon: Settings2 },
  { label: 'Engine', detail: 'Belts, sensors, gaskets', Icon: Cog },
  { label: 'Electrical', detail: 'Bulbs, relays, wiring', Icon: Zap },
];

const FOOTER_LINKS = [
  { label: 'Post request', route: '/requests/create' },
  { label: 'Shop', route: '/shop' },
  { label: 'Bookings', route: '/bookings' },
  { label: 'Vehicles', route: '/vehicles' },
  { label: 'Messages', route: '/messages' },
  { label: 'Roadside', route: '/sos' },
  { label: 'Help', route: '/help' },
  { label: 'Profile', route: '/profile' },
];

const PACKAGES = [
  { title: 'Standard service', detail: 'Oil, filters, 30-point check', category: 'MAINTENANCE' },
  { title: 'AC service', detail: 'Cooling check, gas, cabin filter', category: 'MAINTENANCE' },
  { title: 'Pre-purchase check', detail: '200-point inspection', category: 'INSPECTION' },
];


export default function HomeScreen() {
  const router = useRouter();
  const { user, role, providerProfile } = useAuth();

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  const vehiclesQuery = useVehicles();
  const addressesQuery = useAddresses();
  const replaceAddresses = useReplaceAddresses();
  const [locationOpen, setLocationOpen] = useState(false);
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

  const requests = requestsQuery.data?.items ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];
  const parts = (partsQuery.data?.items ?? []).slice(0, 4);
  const address = addressesQuery.data?.addresses?.[0];
  const homeLocation: PickedLocation | null = address
    ? {
        address: address.address,
        latitude: address.latitude,
        longitude: address.longitude,
        label: address.title,
      }
    : null;

  const saveHomeLocation = async (next: PickedLocation) => {
    const rest = (addressesQuery.data?.addresses ?? []).filter(
      (item) => item.title !== 'Home',
    );
    try {
      await replaceAddresses.mutateAsync([
        {
          id: 'home',
          title: 'Home',
          address: next.address,
          latitude: next.latitude,
          longitude: next.longitude,
        },
        ...rest,
      ]);
    } catch (error: any) {
      Alert.alert(
        'Location not saved',
        error?.message ?? 'Could not save this location. Try again.',
      );
    }
  };
  const vehicle = vehicles[0];
  const nextBooking = (bookingsQuery.data?.items ?? []).find(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );
  const historyBookings = (bookingsQuery.data?.items ?? [])
    .filter((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED')
    .slice(0, 6);
  const loading = requestsQuery.isLoading || bookingsQuery.isLoading;

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

  if (providerProfile?.providerType === 'DRIVER') {
    return <DriverDashboard />;
  }

  if (role === 'PROVIDER' || role === 'BOTH') {
    return <ProviderDashboard />;
  }

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        {/* Chrome */}
        <View style={styles.topBar}>
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>weyro</Text>
            <View style={styles.mark} />
          </View>
          <View style={styles.topActions}>
            <PressableScale
              onPress={() => router.push('/shop')}
              accessibilityRole="button"
              accessibilityLabel="Search parts"
              scaleTo={0.9}
              style={styles.iconButton}
            >
              <Search size={17} color={palette.textSecondary} strokeWidth={1.8} />
            </PressableScale>
            <PressableScale
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              scaleTo={0.9}
              style={styles.iconButton}
            >
              <Bell size={17} color={palette.textSecondary} strokeWidth={1.8} />
              {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
            </PressableScale>
            <PressableScale
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              scaleTo={0.92}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {(user?.customerProfile?.firstName?.[0] || 'W').toUpperCase()}
              </Text>
            </PressableScale>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={HERO_IMAGE}
            style={styles.heroImage}
            contentFit="cover"
            contentPosition="center"
            transition={200}
          />
          <View style={styles.heroScrim} />
          <SideFade reach={0.72} opacity={0.86} />
          <View style={styles.heroContent}>
            <Text style={styles.heroMeta}>Verified garages · escrow payments</Text>
            <Text style={styles.heroTitle}>Service, parts,{'\n'}roadside.</Text>
            <Text style={styles.heroSub}>
              Post one request. Compare quotes from verified garages near you.
            </Text>
            <View style={styles.heroActions}>
              <PressableScale
                onPress={() => router.push('/requests/create')}
                accessibilityRole="button"
                accessibilityLabel="Post a request"
                scaleTo={0.97}
                style={styles.primaryCta}
              >
                <Text style={styles.primaryCtaText}>Post a request</Text>
                <ArrowRight size={16} color={palette.onAccent} strokeWidth={2.2} />
              </PressableScale>
              <PressableScale
                onPress={() => router.push('/shop')}
                accessibilityRole="button"
                accessibilityLabel="Browse parts"
                scaleTo={0.97}
                style={styles.secondaryCta}
              >
                <Text style={styles.secondaryCtaText}>Browse parts</Text>
              </PressableScale>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Location + search */}
          <View style={styles.locationRow}>
            <PressableScale
              onPress={() => setLocationOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Change location"
              scaleTo={0.98}
              style={styles.locationPress}
            >
              <MapPin size={14} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={styles.locationText} numberOfLines={1}>
                {address?.title || address?.address || 'Set your location'}
              </Text>
              <ChevronRight size={14} color={palette.textMuted} strokeWidth={1.8} />
            </PressableScale>
            <PressableScale
              onPress={() => router.push('/sos')}
              accessibilityRole="button"
              accessibilityLabel="Roadside help"
              scaleTo={0.95}
            >
              <Text style={styles.sos}>SOS</Text>
            </PressableScale>
          </View>

          <HomeServiceSections />

          {/* Workshop band — real garages, real people */}
          <View style={styles.bandFull}>
            <Image
              source={require('../../../assets/images/workshop-1.jpg')}
              style={styles.bandImage}
              contentFit="cover"
              contentPosition="center"
              transition={200}
            />
            <View style={styles.bandScrim} />
            <View style={styles.bandContent}>
              <Text style={styles.bandTitle}>Real garages.{`\n`}Real mechanics.</Text>
              <Text style={styles.bandMeta}>Every partner verified before quoting</Text>
            </View>
          </View>

          {/* Vehicle */}
          <Head
            index="02"
            title="Your vehicle"
            action={vehicles.length ? 'All vehicles' : undefined}
            onAction={() => router.push('/vehicles')}
          />
          {vehicle ? (
            <PressableScale
              onPress={() => router.push(`/vehicles/${vehicle.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${vehicle.make} ${vehicle.model}`}
              scaleTo={0.99}
              style={styles.vehicleRow}
            >
              <Image
                source={{ uri: carPhotoFor(vehicle.make, vehicle.model) }}
                style={styles.vehicleThumb}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.vehicleText}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {vehicle.make} {vehicle.model}
                </Text>
                <Text style={styles.vehiclePlate}>
                  {vehicle.registrationNumber} · {vehicle.year}
                </Text>
              </View>
              <Text style={styles.vehicleAction}>Book service</Text>
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => router.push('/vehicles')}
              accessibilityRole="button"
              accessibilityLabel="Add your vehicle"
              scaleTo={0.99}
              style={styles.addVehicle}
            >
              <Text style={styles.addVehicleText}>Add your vehicle to get accurate quotes</Text>
              <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
            </PressableScale>
          )}

          {/* Live status */}
          <Head
            index="03"
            title="Status"
            action="All requests"
            onAction={() => router.push('/requests/my')}
          />
          <View style={styles.statusList}>
            {loading ? (
              <Text style={styles.empty}>Loading…</Text>
            ) : requests.length === 0 && !nextBooking ? (
              <PressableScale
                onPress={() => router.push('/requests/create')}
                accessibilityRole="button"
                accessibilityLabel="Post a request"
                scaleTo={0.99}
                style={styles.indexRow}
              >
                <View style={styles.indexText}>
                  <Text style={styles.indexLabel}>Post a request</Text>
                  <Text style={styles.indexDetail}>Get quotes from verified garages</Text>
                </View>
                <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
              </PressableScale>
            ) : (
              <>
                {requests.slice(0, 2).map((request, i) => (
                  <PressableScale
                    key={request.id}
                    onPress={() => router.push(`/requests/${request.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Request ${request.title}`}
                    scaleTo={0.99}
                    style={[styles.statusRow, i > 0 && styles.rowDivider]}
                  >
                    <View style={styles.statusText}>
                      <Text style={styles.statusTitle} numberOfLines={1}>
                        {request.title}
                      </Text>
                      <Text style={styles.statusMeta}>
                        {labelize(request.category)} · {request.quotationsCount ?? 0} quotes
                      </Text>
                    </View>
                    <StatusPill
                      label={labelize(request.status)}
                      tone={requestTone(request.status)}
                    />
                  </PressableScale>
                ))}
                {nextBooking ? (
                  <PressableScale
                    onPress={() => router.push(`/booking/${nextBooking.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel="Next booking"
                    scaleTo={0.99}
                    style={[styles.statusRow, requests.length > 0 && styles.rowDivider]}
                  >
                    <View style={styles.statusText}>
                      <Text style={styles.statusTitle} numberOfLines={1}>
                        {nextBooking.provider?.businessName ?? 'Booking'}
                      </Text>
                      <Text style={styles.statusMeta}>
                        {[formatDate(nextBooking.scheduledAt), labelize(nextBooking.status)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <StatusPill
                      label={labelize(nextBooking.status)}
                      tone={bookingTone(nextBooking.status)}
                    />
                  </PressableScale>
                ) : null}
              </>
            )}
          </View>

          {/* Dedicated ad space — one per screen, labelled, never in the hero */}
          <AdSlot placement="home-sponsored" />

          {/* Parts — always visible so the section rhythm never skips */}
          <Head
            index="04"
            title="Spare parts"
            action="Shop"
            onAction={() => router.push('/shop')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.rail}
          >
            {parts.length === 0 ? (
              PART_CATEGORIES.map((category) => (
                <PressableScale
                  key={category.label}
                  onPress={() => router.push('/shop')}
                  accessibilityRole="button"
                  accessibilityLabel={`${category.label} parts`}
                  scaleTo={0.98}
                  style={styles.railCard}
                >
                  <View style={styles.railBody}>
                    <category.Icon size={16} color={palette.textSecondary} strokeWidth={1.7} />
                    <Text style={styles.railKicker}>Catalogue</Text>
                    <Text style={styles.railTitle}>{category.label}</Text>
                    <Text style={styles.railMeta}>{category.detail}</Text>
                  </View>
                </PressableScale>
              ))
            ) : (
              parts.map((part) => (
                <PressableScale
                  key={part.id}
                  onPress={() => router.push(`/shop/${part.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Part ${part.name}`}
                  scaleTo={0.98}
                  style={styles.railCard}
                >
                  {part.imageUrl ? (
                    <Image
                      source={{ uri: part.imageUrl }}
                      style={styles.railImage}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : null}
                  <View style={styles.railBody}>
                    <Text style={styles.railKicker}>{labelize(part.condition)}</Text>
                    <Text style={styles.railTitle} numberOfLines={2}>
                      {part.name}
                    </Text>
                    <Text style={styles.railMeta}>{part.partNumber}</Text>
                    <Text style={styles.railPrice}>
                      ₹{Number(part.price).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </PressableScale>
              ))
            )}
          </ScrollView>

          {/* Packages */}
          <Head index="05" title="Packages" />
          <View style={styles.index}>
            {PACKAGES.map((pkg, i) => (
              <PressableScale
                key={pkg.title}
                onPress={() =>
                  router.push(
                    `/requests/create?category=${pkg.category}&title=${encodeURIComponent(pkg.title)}`
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={pkg.title}
                scaleTo={0.99}
                style={[styles.indexRow, i > 0 && styles.rowDivider]}
              >
                <Text style={styles.indexNumber}>P{i + 1}</Text>
                <View style={styles.indexText}>
                  <Text style={styles.indexLabel}>{pkg.title}</Text>
                  <Text style={styles.indexDetail}>{pkg.detail}</Text>
                </View>
                <Text style={styles.packageCta}>Get quotes</Text>
              </PressableScale>
            ))}
          </View>

          {/* Editorial image band — one owned photo, one line */}
          <View style={styles.bandFull}>
            <Image
              source={require('../../../assets/images/hero-secondary.jpg')}
              style={styles.bandImage}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.bandScrim} />
            <View style={styles.bandContent}>
              <Text style={styles.bandTitle}>Every repair,{`
`}documented.</Text>
              <Text style={styles.bandMeta}>Photo quotes · escrow payments</Text>
            </View>
          </View>

          {/* History — second horizontal rail */}
          <Head
            index="06"
            title="History"
            action="Bookings"
            onAction={() => router.push('/bookings')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.rail}
          >
            {historyBookings.length === 0 ? (
              <View style={styles.railCard}>
                <Text style={styles.railKicker}>No history</Text>
                <Text style={styles.railTitle}>Completed services appear here</Text>
              </View>
            ) : (
              historyBookings.map((booking) => (
                <PressableScale
                  key={booking.id}
                  onPress={() => router.push(`/booking/${booking.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel="Past booking"
                  scaleTo={0.98}
                  style={styles.railCard}
                >
                  <Text style={styles.railKicker}>{labelize(booking.status)}</Text>
                  <Text style={styles.railTitle} numberOfLines={2}>
                    {booking.provider?.businessName ?? 'Booking'}
                  </Text>
                  <Text style={styles.railMeta}>
                    {formatDate(booking.scheduledAt ?? booking.createdAt)}
                  </Text>
                </PressableScale>
              ))
            )}
          </ScrollView>

          {/* Assurance */}
          <Head index="07" title="Assurance" />
          <View style={styles.assurance}>
            {[
              ['Verified garages', 'Every partner is reviewed before quoting'],
              ['Photo-based quotes', 'Prices come from the photos you upload'],
              ['Escrow payments', 'Funds release after the work is complete'],
            ].map(([label, detail], i) => (
              <View key={label} style={[styles.assuranceRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.assuranceLabel}>{label}</Text>
                <Text style={styles.assuranceDetail}>{detail}</Text>
              </View>
            ))}
          </View>

          {/* Footer — brand, real links, support, version */}
          <View style={styles.footer}>
            <View style={styles.footerBrandRow}>
              <Text style={styles.footerWordmark}>weyro</Text>
              <View style={styles.footerMark} />
            </View>
            <Text style={styles.footerTagline}>
              Vehicle service and parts, from verified garages.
            </Text>

            <View style={styles.footerLinks}>
              {FOOTER_LINKS.map((link) => (
                <PressableScale
                  key={link.label}
                  onPress={() => router.push(link.route)}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  scaleTo={0.96}
                  style={styles.footerLinkCell}
                >
                  <Text style={styles.footerLink}>{link.label}</Text>
                </PressableScale>
              ))}
            </View>

            <View style={styles.footerSupport}>
              <Text style={styles.footerSupportLabel}>Support</Text>
              <PressableScale
                onPress={() => Linking.openURL('mailto:support@weyro.app')}
                accessibilityRole="link"
                accessibilityLabel="Email Weyro support"
                scaleTo={0.98}
              >
                <Text style={styles.footerSupportLink}>support@weyro.app</Text>
              </PressableScale>
            </View>

            <View style={styles.footerBottom}>
              <Text style={styles.footerMeta}>© 2026 Weyro</Text>
              <Text style={styles.footerMeta}>
                v{Constants.expoConfig?.version ?? '1.0.0'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <LocationPicker
        visible={locationOpen}
        title="Set your location"
        hint="Used to find providers near you"
        initial={homeLocation}
        confirmLabel="Save location"
        onClose={() => setLocationOpen(false)}
        onConfirm={(next) => {
          setLocationOpen(false);
          void saveHomeLocation(next);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 104 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: {
    fontFamily: displayFamily,
    fontSize: 22,
    lineHeight: 24,
    color: palette.textPrimary,
    letterSpacing: -0.4,
  },
  mark: { width: 5, height: 5, backgroundColor: palette.accent, marginTop: 10 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  avatarText: { ...typography.label, color: palette.textSecondary },

  hero: {
    height: 420,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16, 18, 20, 0.28)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroMeta: {
    ...typography.label,
    color: palette.textSecondary,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontFamily: displayFamily,
    fontSize: 38,
    lineHeight: 41,
    letterSpacing: -1,
    color: palette.textPrimary,
  },
  heroSub: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
  },
  primaryCtaText: { ...typography.captionMedium, color: palette.onAccent },
  secondaryCta: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaText: { ...typography.captionMedium, color: palette.textPrimary },

  body: { paddingHorizontal: spacing.lg },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  locationPress: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  locationText: { ...typography.caption, color: palette.textSecondary, flexShrink: 1 },
  sos: { fontFamily: fontFamilyMono, fontSize: 11, color: palette.accent, letterSpacing: 0.4 },

  index: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  indexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  indexNumber: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    width: 20,
  },
  indexText: { flex: 1 },
  indexLabel: { ...typography.bodyMedium, color: palette.textPrimary },
  indexDetail: { ...typography.label, color: palette.textMuted, marginTop: 2 },

  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    paddingVertical: spacing.md,
  },
  vehicleThumb: {
    width: 72,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: palette.surfaceAlt,
  },
  vehicleText: { flex: 1 },
  vehicleName: { ...typography.bodyMedium, color: palette.textPrimary },
  vehiclePlate: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  vehicleAction: { ...typography.label, color: palette.textSecondary },
  addVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  addVehicleText: { ...typography.caption, color: palette.textSecondary, flex: 1 },
  empty: { ...typography.caption, color: palette.textMuted, paddingVertical: spacing.md },

  statusList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  statusText: { flex: 1 },
  statusTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  statusMeta: { ...typography.label, color: palette.textMuted, marginTop: 2 },

  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  partMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  partPrice: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rail: { gap: spacing.sm, paddingRight: spacing.lg },
  railCard: {
    width: 172,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  railImage: { width: '100%', height: 72, backgroundColor: palette.surfaceAlt },
  railBody: { padding: spacing.md, minHeight: 112, gap: 4 },
  railKicker: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  railTitle: { ...typography.captionMedium, color: palette.textPrimary, marginTop: 6 },
  railMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 4,
  },
  railPrice: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  bandFull: {
    height: 220,
    marginTop: spacing.xl,
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  bandImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bandScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16, 18, 20, 0.46)',
  },
  bandContent: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  bandTitle: {
    fontFamily: displayFamily,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.3,
    color: palette.textPrimary,
  },
  bandMeta: { ...typography.label, color: palette.textSecondary, marginTop: 4 },
  assurance: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  assuranceRow: { paddingVertical: spacing.md },
  assuranceLabel: { ...typography.captionMedium, color: palette.textPrimary },
  assuranceDetail: { ...typography.label, color: palette.textMuted, marginTop: 2 },
  packageCta: { ...typography.label, color: palette.textSecondary },

  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  footerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerWordmark: {
    fontFamily: displayFamily,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: palette.textPrimary,
  },
  footerMark: { width: 4, height: 4, backgroundColor: palette.accent, marginTop: 8 },
  footerTagline: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    rowGap: spacing.sm,
  },
  footerLinkCell: { width: '50%', paddingVertical: 2 },
  footerLink: { ...typography.caption, color: palette.textPrimary },
  footerSupport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  footerSupportLabel: { ...typography.label, color: palette.textMuted },
  footerSupportLink: {
    fontFamily: fontFamilyMono,
    fontSize: 12,
    color: palette.textSecondary,
  },
  footerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  footerMeta: { fontFamily: fontFamilyMono, fontSize: 10, color: palette.textMuted },
});
