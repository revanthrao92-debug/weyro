import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useState } from 'react';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  accessibilityLabel?: string;
  loading?: boolean;
}

export function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  loading,
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const isDisabled = disabled || loading;

  const baseStyles = [
    styles.button,
    isPressed && !isDisabled && styles.buttonPressed,
    variant === 'destructive' && styles.buttonDestructive,
    variant === 'secondary' && styles.buttonSecondary,
    isDisabled && styles.buttonDisabled,
  ];

  const textStyles = [
    styles.buttonText,
    variant === 'destructive' && styles.buttonTextDestructive,
  ];

  return (
    <TouchableOpacity
      style={baseStyles}
      onPressIn={() => !isDisabled && setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <Text style={[styles.buttonText, styles.buttonTextLoading]}>…</Text>
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  buttonPressed: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFF7ED',
  },
  buttonDestructive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EF4444',
  },
  buttonSecondary: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  buttonDisabled: {
    opacity: 0.5,
    borderColor: '#E5E7EB',
  },
  buttonText: {
    color: '#208AEF',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonTextDestructive: {
    color: '#EF4444',
  },
  buttonTextLoading: {
    color: '#208AEF',
  },
});
