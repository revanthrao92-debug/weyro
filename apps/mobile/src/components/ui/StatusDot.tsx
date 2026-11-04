import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { palette } from '@/theme';

/**
 * Live teal status dot. Motion with purpose: a single soft pulse marks
 * something changing right now (incoming requests, active jobs). Used
 * sparingly — never decoration.
 */
export function StatusDot({ style }: { style?: ViewStyle }) {
  const [halo] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0.5,
          duration: 1100,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo]);

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View style={[styles.halo, { opacity: halo }, { transform: [{ scale: halo }] }]} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
});
