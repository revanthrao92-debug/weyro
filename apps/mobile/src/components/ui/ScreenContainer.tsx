import { StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing } from '@/theme';

export interface ScreenContainerProps {
  children: ReactNode;
  /** Apply horizontal screen padding. Default true. */
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/**
 * The one screen-level container: sets the canvas background, applies the
 * top safe-area inset (screens have no navigator header to absorb the
 * camera/status-bar area), and standard horizontal padding.
 * `style` is merged last — pass `{ paddingTop: 0 }` when a real header
 * already offsets the content (e.g. the dev gallery).
 */
export function ScreenContainer({
  children,
  padded = true,
  style,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        padded && styles.padded,
        { paddingTop: insets.top },
        style,
      ]}
      accessibilityRole="none"
    >
      {children}
    </View>
  );
}

export interface CardProps {
  children: ReactNode;
  /** Make the whole card pressable-styled (visual only; wire onPress at call site). */
  style?: ViewStyle | ViewStyle[];
}

/**
 * The single surface container: consistent radius, border, and depth —
 * NativeWind classes over the `card`/`border` design tokens. `style` is
 * merged after the class-based base (class wins on nothing but conflicts).
 */
export function Card({ children, style }: CardProps) {
  return (
    <View
      className="rounded-md border border-border bg-card p-4 shadow-sm shadow-black/5"
      style={style}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});

export default ScreenContainer;
