import { StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, typography } from '@/theme';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: ReactNode;
}

/** Error state with an optional retry affordance. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  retryLabel = 'Retry',
  icon,
}: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      {message ? (
        <Text style={styles.message} maxFontSizeMultiplier={2}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <View style={styles.action}>
          <Button title={retryLabel} onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});

export default ErrorState;
