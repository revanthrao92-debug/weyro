import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from './BackButton';
import { PressableScale } from './Motion';
import { palette, spacing, typography, displayFamily } from '@/theme';

export interface PageHeaderProps {
  title: string;
  /** One short line under the title (e.g. "1 saved"). */
  subtitle?: string;
  /** Show the back arrow (pushed screens). Main tabs leave it off. */
  back?: boolean;
  /** Optional action on the right of the top row (e.g. "Add"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Extra content right under the title (e.g. a status pill row). */
  children?: ReactNode;
}

/**
 * The one page header for every screen except Home: back arrow top-left,
 * optional action top-right, then the title on the left. Expects the screen's
 * standard 16px side padding, so the arrow, title and content share one edge.
 */
export function PageHeader({ title, subtitle, back = false, action, children }: PageHeaderProps) {
  return (
    <View style={styles.wrap}>
      {back || action ? (
        <View style={styles.topRow}>
          {back ? <BackButton /> : <View />}
          {action ? (
            <PressableScale
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              scaleTo={0.95}
              style={styles.action}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.sm, marginBottom: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  actionText: { ...typography.bodyMedium, color: palette.accent },
  title: { fontFamily: displayFamily, fontSize: 28, lineHeight: 34, color: palette.textPrimary, marginTop: spacing.sm },
  subtitle: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xs },
});

export default PageHeader;
