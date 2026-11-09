import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { palette, radii, typography } from '@/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  accessibilityLabel?: string;
  loading?: boolean;
  /** Optional extra style (merged after the variant styles). */
  style?: ViewStyle | ViewStyle[];
}

const VARIANTS = {
  primary: {
    backgroundColor: palette.accent,
    pressedColor: palette.accentPressed,
    textColor: palette.onAccent,
    borderColor: palette.accent,
  },
  secondary: {
    backgroundColor: palette.transparent,
    pressedColor: palette.surfaceAlt,
    textColor: palette.textPrimary,
    borderColor: palette.borderStrong,
  },
  destructive: {
    backgroundColor: palette.danger,
    pressedColor: '#C95547',
    textColor: palette.onDanger,
    borderColor: palette.danger,
  },
} as const;

/**
 * Primary action control — pure StyleSheet (no className dependency) so the
 * CTA can never render invisible when the styling pipeline misbehaves.
 * ≥48px touch target, disabled/loading states exposed to assistive tech.
 */
export function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  loading,
  style,
}: ButtonProps) {
  const isDisabled = disabled || !!loading;
  const v = VARIANTS[variant];

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? v.pressedColor : v.backgroundColor,
          borderColor: v.borderColor,
        },
        variant === 'secondary' && styles.outlined,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.textColor} accessibilityLabel="Loading" />
      ) : (
        <Text style={[styles.label, { color: v.textColor }]} maxFontSizeMultiplier={2}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    minWidth: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 0,
  },
  outlined: {
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.bodyMedium,
    textAlign: 'center',
  },
});

export default Button;
