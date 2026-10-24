import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { palette, spacing, typography } from '@/theme';

export interface InputProps extends Omit<TextInputProps, 'autoCompleteType'> {
  autoCompleteType?: string;
  label?: string;
  error?: string;
  accessibilityLabel?: string;
  /** Style for the outer wrapper (label + input + error). */
  containerStyle?: ViewStyle | ViewStyle[];
}

/**
 * Text field — NativeWind base classes with theme-token state colors.
 * Renders its `label` and `error` (labels also set accessibilityLabel).
 * Keeps the original props signature, including the legacy
 * `autoCompleteType` passthrough.
 */
export function Input({
  label,
  error,
  autoCompleteType,
  accessibilityLabel,
  containerStyle,
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
    <View style={[styles.wrapper, containerStyle]}>
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
        className={cn(
          'flex-row items-center rounded-md border bg-card px-3 py-2 text-base text-foreground min-h-[48px]',
          props.editable === false && 'opacity-50'
        )}
        style={[
          { borderColor, backgroundColor: hasError ? palette.dangerSoftBg : palette.surface },
          style,
        ]}
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
  error: {
    ...typography.caption,
    color: palette.danger,
    marginTop: spacing.xs,
  },
});

export default Input;
