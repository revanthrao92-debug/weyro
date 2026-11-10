import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { PressableScale } from './Motion';
import { palette, spacing, typography } from '@/theme';

export interface SectionProps {
  /** Small uppercase index/label, e.g. "02 — VEHICLE". */
  eyebrow?: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Editorial section frame: orange measurement tick, tracked eyebrow, rule.
 * Gives screens a technical, automotive-spec rhythm instead of loose titles.
 */
export function Section({
  eyebrow,
  title,
  actionLabel,
  onAction,
  children,
  style,
}: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {eyebrow || actionLabel ? (
        <View style={styles.head}>
          <View style={styles.tick} />
          <Text style={styles.eyebrow} maxFontSizeMultiplier={2}>
            {eyebrow ?? ''}
          </Text>
          <View style={styles.spacer} />
          {actionLabel ? (
            <PressableScale
              onPress={onAction}
              scaleTo={0.95}
              accessibilityRole="link"
              accessibilityLabel={actionLabel}
            >
              <Text style={styles.action} maxFontSizeMultiplier={2}>
                {actionLabel}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      {title ? (
        <Text style={styles.title} maxFontSizeMultiplier={1.6}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tick: {
    width: 2,
    height: 10,
    backgroundColor: palette.accent,
  },
  eyebrow: {
    ...typography.label,
    color: palette.textSecondary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  spacer: { flex: 1 },
  action: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 0.4,
  },
  title: {
    ...typography.title,
    color: palette.textPrimary,
    marginBottom: spacing.md,
  },
});

export default Section;
