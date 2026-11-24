import { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { palette, spacing, radii } from '@/theme';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Loading placeholder with a light band sweeping across it (UI thread).
 * Static under Reduce Motion.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: SkeletonProps) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduced || w === 0) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1);
    return () => cancelAnimation(x);
  }, [reduced, w, x]);

  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: -w * 0.6 + x.value * w * 1.6 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      {reduced ? null : <Animated.View style={[styles.band, { width: w * 0.6 }, band]} />}
    </View>
  );
}

/** Convenience block of a few stacked skeletons (heading + lines). */
export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.block}>
      <Skeleton width="60%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width="100%" height={12} style={{ marginTop: spacing.sm }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
  },
  band: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  block: {
    paddingVertical: spacing.sm,
  },
});

export default Skeleton;
