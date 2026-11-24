import { ReactNode, useEffect } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { durations, palette, springs } from '@/theme';

/**
 * Motion primitives — thin wrappers over Reanimated so every screen uses the
 * same durations, distances and press feel. All animations are transform /
 * opacity only (UI thread) and respect the OS "Reduce Motion" setting.
 */

export interface FadeSlideInProps {
  children: ReactNode;
  /** Delay in ms (use `stagger(index)` for lists). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Subtle fade + slide-up entrance, played once on mount. */
export function FadeSlideIn({ children, delay = 0, style }: FadeSlideInProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={
        reducedMotion
          ? undefined
          : FadeInDown.duration(durations.base).delay(delay)
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export interface PressableScaleProps extends PressableProps {
  children: ReactNode;
  /** Pressed scale. 0.97 for buttons, 0.98–0.99 for large cards. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Premium press feedback: a short spring scale + tiny dim. Replaces the
 * default opacity/color flash and works for buttons, cards and list rows.
 */
export function PressableScale({
  children,
  scaleTo = 0.97,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reducedMotion && !disabled) {
          pressed.value = withSpring(1, springs.press);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, springs.press);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Slow expanding ring behind an urgent control (SOS). One ring, low amplitude,
 * every ~2 s; nothing under Reduce Motion.
 */
export function Pulse({
  children,
  color = palette.accent,
  radius = 8,
  style,
}: {
  children: ReactNode;
  color?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
  }, [reducedMotion, t]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 1 + 0.18 * t.value }],
  }));

  return (
    <View style={style}>
      {reducedMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 2, borderColor: color }, ring]}
        />
      )}
      {children}
    </View>
  );
}

/**
 * One-time spring scale-in. Give it a `key` that changes with the state it
 * marks (e.g. the booking status) so it replays only when that state changes.
 */
export function PopIn({
  children,
  play = true,
  style,
}: {
  children: ReactNode;
  play?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      entering={play && !reducedMotion ? ZoomIn.springify().damping(14) : undefined}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Accent outline that fades out once, marking something that just arrived. */
export function FlashBorder({
  children,
  active,
  radius = 8,
  style,
}: {
  children: ReactNode;
  active: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const o = useSharedValue(active && !reducedMotion ? 1 : 0);

  useEffect(() => {
    if (active && !reducedMotion) o.value = withDelay(1200, withTiming(0, { duration: 1400 }));
  }, [active, reducedMotion, o]);

  const outline = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <View style={style}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: 2, borderColor: palette.accent },
          outline,
        ]}
      />
    </View>
  );
}
