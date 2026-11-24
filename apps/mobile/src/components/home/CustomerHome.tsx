import { useEffect, useState } from 'react';
import {
  Image as RNImage,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Bell, ChevronRight, LifeBuoy, MapPin, Package, Settings2, Wrench } from 'lucide-react-native';
import type { useRouter } from 'expo-router';
import { PressableScale, Pulse } from '@/components/ui';
import { requestRoute } from '@/components/home/serviceCatalog';
import { carPhotoFor } from '@/lib/photos';
import { haptics } from '@/lib/haptics';
import { displayFamily, palette } from '@/theme';
import type { Booking } from '@/hooks/useBookings';
import type { ServiceRequest } from '@/hooks/useRequests';
import type { Vehicle } from '@/hooks/useProfile';

/**
 * Customer Home. Short and live: the car first, SOS within reach, the job that
 * is moving, then shortcuts. Motion is scroll-linked (hero) or shows live state
 * (job card); everything is static under Reduce Motion.
 */
const t = {
  bg: palette.canvas, surface: palette.surface, line: palette.border, text: palette.textPrimary,
  muted: palette.textMuted, action: palette.accent, onAction: palette.onAccent, trust: palette.accent,
  sos: palette.sos, onSos: palette.onSos,
  active: palette.statusActive, progress: palette.statusProgress, done: palette.statusDone,
};
type Tokens = typeof t;

// Fallback hero when there is no photo for the customer's car make.
const HERO_IMAGE = require('../../../assets/images/hero-primary.jpg');
const HERO_H = 300;

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function CustomerHome({
  router,
  firstName,
  vehicle,
  nextBooking,
  requests,
  unreadCount,
  onRefresh,
  locationLabel,
  onLocationPress,
}: {
  router: ReturnType<typeof useRouter>;
  firstName?: string | null;
  vehicle?: Vehicle;
  nextBooking?: Booking;
  requests: ServiceRequest[];
  unreadCount: number;
  onRefresh: () => Promise<void>;
  locationLabel?: string;
  onLocationPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Parallax on the way up, a little stretch when pulled down.
  const heroImage = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0, HERO_H], [-60, 0, HERO_H * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.25, 1], Extrapolation.CLAMP) },
    ],
  }));
  const compactBar = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H - 140, HERO_H - 80], [0, 1], Extrapolation.CLAMP),
  }));

  const carName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Your car';
  const photo = vehicle ? carPhotoFor(vehicle.make, vehicle.model) : null;
  const waiting = requests.find(
    (r) => ['OPEN', 'QUOTES_RECEIVED'].includes(r.status) && (r.quotationsCount ?? 0) > 0,
  );
  const enter = (i: number) => (reduced ? undefined : FadeInDown.duration(420).delay(120 + i * 90));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={t.muted}
            onRefresh={async () => {
              setRefreshing(true);
              await onRefresh().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {/* Hero: the customer's own car */}
        <View style={[styles.hero, { height: HERO_H + insets.top }]}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImage]}>
            <RNImage
              source={photo ? { uri: photo } : HERO_IMAGE}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Animated.View>
          <View style={[StyleSheet.absoluteFill, styles.heroScrim]} />
          <Animated.View entering={enter(0)} style={[styles.heroText, { paddingTop: insets.top + 56 }]}>
            <Text style={styles.hello}>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={styles.car} numberOfLines={1}>
              {carName}
            </Text>
            {vehicle ? <Text style={styles.plate}>{vehicle.registrationNumber}</Text> : null}
            <PressableScale
              onPress={onLocationPress}
              accessibilityRole="button"
              accessibilityLabel="Change location"
              scaleTo={0.97}
              style={styles.location}
            >
              <MapPin size={14} color={palette.onPhotoMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLabel || 'Set your location'}
              </Text>
            </PressableScale>
          </Animated.View>
        </View>

        <View style={styles.body}>
          {/* SOS: the one control that must never be hard to find */}
          <Animated.View entering={enter(1)}>
            <Pulse color={t.sos} radius={14}>
              <PressableScale
                onPress={() => {
                  haptics.heavy();
                  router.push('/sos');
                }}
                accessibilityRole="button"
                accessibilityLabel="Get roadside help now"
                scaleTo={0.97}
                style={[styles.sos, { backgroundColor: t.sos }]}
              >
                <LifeBuoy size={22} color={t.onSos} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sosTitle, { color: t.onSos }]}>Stuck on the road?</Text>
                  <Text style={[styles.sosSub, { color: t.onSos }]}>Tow, jumpstart, tyre, fuel</Text>
                </View>
                <ChevronRight size={20} color={t.onSos} />
              </PressableScale>
            </Pulse>
          </Animated.View>

          {nextBooking ? (
            <Animated.View entering={enter(2)}>
              <LiveJobCard t={t} booking={nextBooking} onOpen={() => router.push(`/booking/${nextBooking.id}`)} />
            </Animated.View>
          ) : waiting ? (
            <Animated.View entering={enter(2)}>
              <PressableScale
                onPress={() => router.push(`/requests/${waiting.id}`)}
                accessibilityRole="button"
                scaleTo={0.98}
                style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}
              >
                <Text style={[styles.cardEyebrow, { color: t.trust }]}>
                  {waiting.quotationsCount} {waiting.quotationsCount === 1 ? 'quote' : 'quotes'} waiting
                </Text>
                <Text style={[styles.cardTitle, { color: t.text }]}>{waiting.title}</Text>
                <Text style={[styles.cardMeta, { color: t.muted }]}>Compare prices and pick a garage</Text>
              </PressableScale>
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(3)} style={styles.grid}>
            {[
              { label: 'Repair', detail: 'Dents, paint, damage', Icon: Wrench, go: requestRoute('REPAIR') },
              { label: 'Service', detail: 'Oil, filters, check-up', Icon: Settings2, go: requestRoute('MAINTENANCE') },
              { label: 'Parts', detail: 'Genuine and aftermarket', Icon: Package, go: '/shop' },
              { label: 'Messages', detail: unreadCount ? `${unreadCount} new` : 'Your garages', Icon: Bell, go: '/messages' },
            ].map(({ label, detail, Icon, go }) => (
              <PressableScale
                key={label}
                onPress={() => router.push(go as never)}
                accessibilityRole="button"
                accessibilityLabel={label}
                scaleTo={0.95}
                style={[styles.tile, { backgroundColor: t.surface, borderColor: t.line }]}
              >
                <Icon size={22} color={t.action} strokeWidth={1.9} />
                <Text style={[styles.tileLabel, { color: t.text }]}>{label}</Text>
                <Text style={[styles.tileDetail, { color: t.muted }]} numberOfLines={1}>
                  {detail}
                </Text>
              </PressableScale>
            ))}
          </Animated.View>

          <PressableScale
            onPress={() => router.push(requestRoute('REPAIR'))}
            accessibilityRole="button"
            scaleTo={0.97}
            style={[styles.cta, { backgroundColor: t.action }]}
          >
            <Text style={[styles.ctaText, { color: t.onAction }]}>Describe a problem, get quotes</Text>
          </PressableScale>
        </View>
      </Animated.ScrollView>

      {/* Compact bar fades in as the hero scrolls away */}
      <Animated.View
        pointerEvents="none"
        style={[styles.compact, { paddingTop: insets.top + 10, backgroundColor: t.bg, borderColor: t.line }, compactBar]}
      >
        <Text style={[styles.compactText, { color: t.text }]} numberOfLines={1}>
          {carName}
        </Text>
      </Animated.View>
    </View>
  );
}

const STAGES_FULL = ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];
const STAGE_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PROVIDER_EN_ROUTE: 'On the way',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Done',
};

/** The job that is moving: a stage bar that slides forward as the garage updates it. */
function LiveJobCard({ t, booking, onOpen }: { t: Tokens; booking: Booking; onOpen: () => void }) {
  const reduced = useReducedMotion();
  const dropOff = booking.quotation?.deliveryMethod === 'PICKUP';
  const stages = dropOff ? STAGES_FULL.filter((s) => s !== 'PROVIDER_EN_ROUTE') : STAGES_FULL;
  const index = Math.max(0, stages.indexOf(booking.status));
  const color = booking.status === 'IN_PROGRESS' ? t.progress : t.active;

  const [trackW, setTrackW] = useState(0);
  const fill = useSharedValue(0);
  const dot = useSharedValue(1);

  useEffect(() => {
    const target = trackW * ((index + 1) / stages.length);
    fill.value = reduced ? target : withTiming(target, { duration: 700 });
  }, [index, stages.length, trackW, reduced, fill]);

  useEffect(() => {
    if (reduced) return;
    dot.value = withRepeat(withTiming(0.25, { duration: 900 }), -1, true);
    return () => cancelAnimation(dot);
  }, [reduced, dot]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));

  return (
    <PressableScale
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Your job with ${booking.provider?.businessName ?? 'the garage'}: ${STAGE_LABEL[booking.status] ?? booking.status}`}
      scaleTo={0.98}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}
    >
      <View style={styles.liveRow}>
        <Animated.View style={[styles.liveDot, { backgroundColor: color }, dotStyle]} />
        <Text style={[styles.cardEyebrow, { color }]}>{STAGE_LABEL[booking.status] ?? booking.status}</Text>
      </View>
      <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={1}>
        {booking.quotation?.request?.title ?? 'Your job'}
      </Text>
      <Text style={[styles.cardMeta, { color: t.muted }]} numberOfLines={1}>
        {booking.provider?.businessName ?? 'Garage'}
      </Text>
      <View
        style={[styles.track, { backgroundColor: t.line }]}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
      <View style={styles.stageLabels}>
        {stages.map((s, i) => (
          <Text
            key={s}
            style={[styles.stageLabel, { color: i <= index ? t.text : t.muted }]}
            numberOfLines={1}
          >
            {STAGE_LABEL[s]}
          </Text>
        ))}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: 'hidden', backgroundColor: '#000' },
  heroScrim: { backgroundColor: palette.scrim },
  heroText: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 44 },
  hello: { color: palette.onPhotoMuted, fontSize: 15, fontWeight: '500' },
  car: { color: palette.onPhoto, fontFamily: displayFamily, fontSize: 34, lineHeight: 40, marginTop: 4 },
  plate: { color: palette.onPhotoMuted, fontSize: 13, letterSpacing: 1, marginTop: 6 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', minHeight: 32 },
  locationText: { color: palette.onPhotoMuted, fontSize: 13, maxWidth: 260 },
  body: { paddingHorizontal: 16, marginTop: -26, gap: 14 },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14 },
  sosTitle: { fontSize: 17, fontWeight: '700' },
  sosSub: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  cardEyebrow: { fontSize: 13, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '600', marginTop: 6 },
  cardMeta: { fontSize: 14, marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 6, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  stageLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stageLabel: { fontSize: 11, flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 104 },
  tileLabel: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  tileDetail: { fontSize: 12, marginTop: 2 },
  cta: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700' },
  compact: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactText: { fontFamily: displayFamily, fontSize: 18 },
});
