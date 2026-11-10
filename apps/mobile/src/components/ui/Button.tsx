import { ActivityIndicator, StyleSheet, Text, ViewStyle } from 'react-native';
import { PressableScale } from './Motion';
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
    textColor: palette.onAccent,
    borderColor: palette.accent,
  },
  secondary: {
    backgroundColor: palette.transparent,
    textColor: palette.textPrimary,
    borderColor: palette.borderStrong,
  },
  destructive: {
    backgroundColor: palette.danger,
    textColor: palette.onDanger,
    borderColor: palette.danger,
  },
} as const;

/**
 * Primary action control — pure StyleSheet (no className dependency) with the
 * shared spring press feedback. ≥48px touch target, disabled/loading exposed
 * to assistive tech.
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
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      scaleTo={0.97}
      style={[
        styles.base,
        {
          backgroundColor: v.backgroundColor,
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
    </PressableScale>
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
