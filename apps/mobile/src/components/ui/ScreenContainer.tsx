import { StyleSheet, View, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
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
  cardBase: { width: '100%' },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingVertical: spacing.lg,
  },
  panel: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 8,
    padding: spacing.lg,
  },
  rail: {
    backgroundColor: palette.surfaceAlt,
    borderLeftWidth: 2,
    borderLeftColor: palette.accent,
    borderRadius: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
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

export type CardVariant = 'rule' | 'panel' | 'rail';

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /**
   * `rule` (default) — quiet work-order section separated by a hairline.
   * `panel` — a contained surface for an object that needs its own field
   * (chart, toggle, media).
   * `rail` — a surface with an accent edge, for the one live/primary block.
   */
  variant?: CardVariant;
}

/**
 * Work-order sheet surface. Most content is separated by rules, not boxed;
 * panels are reserved for objects that genuinely sit above the page.
 */
export function Card({ children, style, variant = 'rule' }: CardProps) {
  return (
    <View style={[styles.cardBase, styles[variant], style]}>
      {children}
    </View>
  );
}
