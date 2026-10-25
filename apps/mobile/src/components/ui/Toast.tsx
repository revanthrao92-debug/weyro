import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { palette, spacing, radii, typography, elevation } from '@/theme';

export interface ToastProps {
  message: string;
  /** Auto-hide delay in ms. 0 keeps it until unmounted. */
  duration?: number;
}

/**
 * Lightweight transient feedback for non-destructive confirms (replaces some
 * scattered Alert use). Mount conditionally from the call site. Opacity+slide
 * only — subtle, purposeful motion via built-in Animated.
 */
export function Toast({ message, duration = 2500 }: ToastProps) {
  const [translateY] = useState(() => new Animated.Value(20));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();

    if (duration > 0) {
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity, transform: [{ translateY }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text} maxFontSizeMultiplier={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: palette.textPrimary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...elevation.sheet,
  },
  text: {
    ...typography.bodyMedium,
    color: palette.surface,
    textAlign: 'center',
  },
});

export default Toast;
