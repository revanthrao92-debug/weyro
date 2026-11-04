import { StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, typography } from '@/theme';
import { PorscheSketch911 } from '../art/PorscheSketch911';

export interface EmptyStateProps {
  title: string;
  message?: string;
  /** Optional CTA rendered below the message. */
  action?: ReactNode;
  /** Optional icon. When omitted, the Weyro 911 sketch is the illustration. */
  icon?: ReactNode;
  /** Show the signature sketch even when an icon exists. */
  withSketch?: boolean;
}

/**
 * Friendly empty state. Identity: the 911 sketch is the default
 * illustration (signature detail from the direction), so empty screens
 * still say Weyro.
 */
export function EmptyState({ title, message, action, icon, withSketch }: EmptyStateProps) {
  const showSketch = withSketch || !icon;
  return (
    <View style={styles.container} accessibilityRole="text">
      {showSketch && !icon ? (
        <View style={styles.sketch} accessibilityElementsHidden>
          <PorscheSketch911 opacity={0.16} strokeWidth={3} />
        </View>
      ) : null}
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
  sketch: {
    width: 220,
    height: 84,
    marginBottom: spacing.md,
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
