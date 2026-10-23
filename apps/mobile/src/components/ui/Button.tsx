import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { palette, spacing, radii, typography } from '@/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  accessibilityLabel?: string;
  loading?: boolean;
  /** Optional leading content (e.g. an Icon). Visual only. */
  style?: ViewStyle | ViewStyle[];
}

/**
 * Primary action control. Keeps the original props signature (title, onPress,
 * disabled, variant, accessibilityLabel, loading) — `style` is additive.
 * Loading now shows a real spinner instead of an ellipsis.
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

  const containerStyles = [
    styles.button,
    variant === 'secondary' && styles.secondary,
    variant === 'destructive' && styles.destructive,
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyles = [
    styles.label,
    variant === 'secondary' && styles.labelSecondary,
    variant === 'destructive' && styles.labelDestructive,
  ];

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        containerStyles,
        pressed && !isDisabled && pressedStyles[variant],
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? palette.onAccent : palette.accent}
          accessibilityLabel="Loading"
        />
      ) : (
        <Text style={labelStyles} maxFontSizeMultiplier={2}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const pressedStyles = {
  primary: { backgroundColor: palette.accentPressed },
  secondary: { backgroundColor: palette.surfaceAlt },
  destructive: { backgroundColor: palette.danger, opacity: 0.85 },
} as const;

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // ≥44px touch target
    minWidth: 44,
  },
  secondary: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  destructive: {
    backgroundColor: palette.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.bodyMedium,
    color: palette.onAccent,
  },
  labelSecondary: {
    color: palette.textPrimary,
  },
  labelDestructive: {
    color: palette.onDanger,
  },
});

export default Button;
