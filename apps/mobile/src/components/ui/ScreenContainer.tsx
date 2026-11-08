import { StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing } from '@/theme';

export interface ScreenContainerProps {
  children: ReactNode;
  /** Apply horizontal screen padding. Default true. */
  padded?: boolean;
  /** Add the bottom safe-area inset (screens without a tab bar). */
  safeBottom?: boolean;
  /**
   * Color of the top safe-area strip behind the status bar.
   * Must match the screen header so the chrome reads as one unbroken bar:
   *  - 'dark'  navy chrome (dark AppHeader, Home hero)
   *  - 'light' white chrome (light AppHeader)
   *  - 'none'  canvas color (screens with no edge-to-edge header)
   */
  chrome?: 'dark' | 'light' | 'none';
  style?: ViewStyle | ViewStyle[];
}

/**
 * The one screen-level container. Two layers:
 * Outer layer paints the status-bar strip with the header chrome color so the
 * dark/light bar extends edge-to-edge behind the clock. Inner layer is the
 * light content canvas and carries the standard horizontal padding
 * (headers compensate with negative margins to stay full-bleed).
 */
export function ScreenContainer({
  children,
  padded = true,
  safeBottom = false,
  chrome = 'none',
  style,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const chromeColor =
    chrome === 'dark' ? palette.header : chrome === 'light' ? palette.surface : palette.canvas;
  return (
    <View
      style={[styles.root, { backgroundColor: chromeColor, paddingTop: insets.top }]}
      accessibilityRole="none"
    >
      <View
        style={[
          styles.canvas,
          padded && styles.padded,
          safeBottom && { paddingBottom: insets.bottom },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});

export default ScreenContainer;

export interface CardProps {
  children: ReactNode;
  /** Make the whole card pressable-styled (visual only; wire onPress at call site). */
  style?: ViewStyle | ViewStyle[];
}

/**
 * The single surface container: consistent radius, border, and depth.
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
