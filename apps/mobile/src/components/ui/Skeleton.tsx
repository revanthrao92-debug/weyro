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
 * Skeleton placeholder. One calm fade-in on mount (opacity 0.4 → 0.85) —
 * unslop: no perpetual looping pulse on a non-live element.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0.85,
      duration: 420,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
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
