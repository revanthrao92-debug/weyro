import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { palette, spacing, radii } from '@/theme';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Shimmer placeholder. Subtle opacity-only pulse using React Native's built-in
 * Animated API (no extra animation dependency, no babel plugin required).
 * Motion is purposeful and gentle — a calm "loading" cue, not a distraction.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width, height, borderRadius: radius },
        { opacity },
        style,
      ]}
    />
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
  },
  block: {
    paddingVertical: spacing.sm,
  },
});

export default Skeleton;
