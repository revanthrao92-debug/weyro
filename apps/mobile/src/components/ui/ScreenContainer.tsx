import { StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, radii, elevation } from '@/theme';

export interface ScreenContainerProps {
  children: ReactNode;
  /** Apply horizontal screen padding. Default true. */
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/**
 * The one screen-level container: sets the canvas background and standard
 * horizontal padding. Replaces per-screen ad-hoc wrapper Views.
 */
export function ScreenContainer({
  children,
  padded = true,
  style,
}: ScreenContainerProps) {
  return (
    <View
      style={[styles.root, padded && styles.padded, style]}
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

/** The single surface container: consistent radius, border, and soft depth. */
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    ...elevation.card,
  },
});

export default ScreenContainer;
