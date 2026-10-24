import { StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, typography } from '@/theme';

export interface AppHeaderProps {
  title: string;
  /** Optional element rendered on the left (e.g. a back button). */
  left?: ReactNode;
  /** Optional element rendered on the right (e.g. an action). */
  right?: ReactNode;
  /** Optional subtitle / supporting line. */
  subtitle?: string;
}

/**
 * The one screen header: consistent title typography and spacing. Back button
 * and actions are passed in as nodes so navigation behavior stays at the call
 * site (no navigation logic changes here).
 */
export function AppHeader({ title, subtitle, left, right }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      {/* Both side slots always render so the centered title stays centered
          (a missing left spacer used to shift every header ~22px left). */}
      {left ? <View style={styles.side}>{left}</View> : <View style={styles.side} />}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} maxFontSizeMultiplier={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.side}>{right}</View> : <View style={styles.side} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    // Header must read as its own section above content: a real (1px)
    // divider + a full spacing step below, not a hairline + 4px.
    borderBottomWidth: 1,
    borderBottomColor: palette.borderStrong,
    marginBottom: spacing.md,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.heading,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default AppHeader;
