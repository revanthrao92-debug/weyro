import { ReactNode } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { durations, springs } from '@/theme';

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

/** Style helper for screens that need the same pressed feel on a plain View. */
export const motionStyles = StyleSheet.create({
  fill: { flex: 1 },
});
