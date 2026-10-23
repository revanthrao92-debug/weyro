import { StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, typography } from '@/theme';

export interface EmptyStateProps {
  title: string;
  message?: string;
  /** Optional CTA rendered below the message. */
  action?: ReactNode;
  icon?: ReactNode;
}

/** Friendly empty state: title + supporting copy + optional action. */
export function EmptyState({ title, message, action, icon }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      {message ? (
        <Text style={styles.message} maxFontSizeMultiplier={2}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
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

export default EmptyState;
