import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { ArrowRight, ChevronRight, MapPin } from 'lucide-react-native';
import type { useRouter } from 'expo-router';
import { PressableScale } from '@/components/ui';
import { carPhotoFor } from '@/lib/photos';
import { haptics } from '@/lib/haptics';
import { palette, radii, spacing, typography, displayFamily } from '@/theme';
import type { Vehicle } from '@/hooks/useProfile';
import { HERO_IMAGE } from './shared';

const HEIGHT = 260;

/**
 * "Your car": the customer's own car first, with the one main action. The
 * photo drifts slower than the page and stretches on pull-down.
 */
export function CarHero({ router, vehicle, locationLabel, onLocationPress, scrollY }: {
  router: ReturnType<typeof useRouter>;
  vehicle?: Vehicle;
  locationLabel?: string;
  onLocationPress: () => void;
  scrollY: SharedValue<number>;
}) {
  const photo = vehicle ? carPhotoFor(vehicle.make, vehicle.model) : null;
  const image = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0, HEIGHT], [-40, 0, HEIGHT * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.2, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.photo}>
        <Animated.View style={[StyleSheet.absoluteFill, image]}>
          <Image source={photo ? { uri: photo } : HERO_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        <View style={styles.text}>
          <Text style={styles.kicker}>{vehicle ? 'Your car' : 'Add your car to get started'}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Your vehicle'}
          </Text>
          {vehicle ? <Text style={styles.plate}>{vehicle.registrationNumber}</Text> : null}
        </View>
      </View>

      <PressableScale
        onPress={onLocationPress}
        accessibilityRole="button"
        accessibilityLabel="Change location"
        scaleTo={0.98}
        style={styles.location}
      >
        <MapPin size={16} color={palette.textMuted} strokeWidth={1.8} />
        <Text style={styles.locationText} numberOfLines={1}>
          {locationLabel || 'Set your location'}
        </Text>
        <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
      </PressableScale>

      <PressableScale
        onPress={() => {
          haptics.tap();
          router.push(vehicle ? '/requests/create' : '/vehicles');
        }}
        accessibilityRole="button"
        accessibilityLabel={vehicle ? 'Get help with your car' : 'Add your car'}
        scaleTo={0.97}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>{vehicle ? 'Get help with your car' : 'Add your car'}</Text>
        <ArrowRight size={18} color={palette.onAccent} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, gap: spacing.md },
  photo: { height: HEIGHT, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: palette.surfaceAlt },
  scrim: { backgroundColor: palette.scrim },
  text: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  kicker: { ...typography.captionMedium, color: palette.onPhotoMuted },
  name: { fontFamily: displayFamily, fontSize: 28, lineHeight: 34, color: palette.onPhoto, marginTop: 2 },
  plate: { ...typography.caption, color: palette.onPhotoMuted, letterSpacing: 1, marginTop: 2 },
  location: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  locationText: { ...typography.caption, color: palette.textSecondary, flex: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
  },
  ctaText: { ...typography.bodyMedium, color: palette.onAccent },
});
