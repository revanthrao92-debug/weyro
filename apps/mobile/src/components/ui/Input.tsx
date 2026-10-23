import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { useState } from 'react';
import { palette, spacing, radii, typography } from '@/theme';

export interface InputProps extends Omit<TextInputProps, 'autoCompleteType'> {
  autoCompleteType?: string;
  label?: string;
  error?: string;
  accessibilityLabel?: string;
}

/**
 * Text field. Now actually renders its `label` and `error` (previously they
 * were accepted but ignored — screens drew manual labels). Keeps the original
 * props signature, including the legacy `autoCompleteType` passthrough.
 */
export function Input({
  label,
  error,
  autoCompleteType,
  accessibilityLabel,
  style,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;

  const borderColor = hasError
    ? palette.danger
    : isFocused
      ? palette.accent
      : palette.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label} maxFontSizeMultiplier={2}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...props}
        {...(autoCompleteType ? { autoCompleteType } : {})}
        editable={props.editable !== false}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="text"
        accessibilityState={
          (hasError
            ? { invalid: true }
            : isFocused
              ? { focused: true }
              : undefined) as TextInputProps['accessibilityState']
        }
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, { borderColor }, hasError && styles.inputError, style]}
        placeholderTextColor={palette.textMuted}
      />
      {hasError ? (
        <Text style={styles.error} maxFontSizeMultiplier={2} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: palette.textPrimary,
    backgroundColor: palette.surface,
  },
  inputError: {
    // border color set inline; keep a subtle tinted background for non-color-only signal
    backgroundColor: palette.dangerSoftBg,
  },
  error: {
    ...typography.caption,
    color: palette.danger,
    marginTop: spacing.xs,
  },
});

export default Input;
