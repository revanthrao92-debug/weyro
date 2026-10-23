import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useState } from 'react';

export interface InputProps extends Omit<TextInputProps, 'autoCompleteType'> {
  autoCompleteType?: string;
  label?: string;
  error?: string;
  accessibilityLabel?: string;
}

export function Input({
  label,
  error,
  autoCompleteType,
  accessibilityLabel,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;

  const borderColor = hasError
    ? '#EF4444'
    : isFocused
      ? '#F59E0B'
      : '#E5E7EB';

  return (
    <TextInput
      {...(props as any)}
      autoCompleteType={autoCompleteType}
      editable={props.editable !== false}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="text"
      accessibilityState={
        error ? { invalid: true } : isFocused ? { focused: true } : undefined
      }
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={[
        styles.input,
        { borderColor },
        hasError && styles.inputError,
        isFocused && styles.inputFocused,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputFocused: {
    borderColor: '#F59E0B',
  },
});
