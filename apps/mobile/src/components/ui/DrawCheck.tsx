import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const CIRCLE_LEN = 2 * Math.PI * 10; // r = 10 in a 24 viewBox
const TICK_LEN = 14.1; // length of "M7 12.5l3.2 3.2L17 9" (4.53 + 9.55)

/** Check mark that draws itself once (circle, then tick). Drawn instantly under Reduce Motion. */
export function DrawCheck({ size = 28, color }: { size?: number; color: string }) {
  const reduced = useReducedMotion();
  const circle = useSharedValue(reduced ? 1 : 0);
  const tick = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    circle.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    tick.value = withDelay(350, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [reduced, circle, tick]);

  const circleProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCLE_LEN * (1 - circle.value) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK_LEN * (1 - tick.value) }));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <AnimatedCircle
        cx={12}
        cy={12}
        r={10}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeDasharray={CIRCLE_LEN}
        animatedProps={circleProps}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
      <AnimatedPath
        d="M7 12.5l3.2 3.2L17 9"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeDasharray={TICK_LEN}
        animatedProps={tickProps}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    </View>
  );
}
