import { TouchableOpacity, Text, StyleSheet } from 'react-native';

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
  const baseStyles = [
    styles.button,
    variant === 'destructive' && styles.buttonDestructive,
    variant === 'secondary' && styles.buttonSecondary,
    disabled && styles.buttonDisabled,
  ];

  return (
    <TouchableOpacity
      style={baseStyles}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <Text style={[styles.buttonText, styles.buttonTextLoading]}>…</Text>
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDestructive: {
    backgroundColor: '#EF4444',
  },
  buttonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonTextLoading: {
    color: '#FFFFFF',
  },
});
