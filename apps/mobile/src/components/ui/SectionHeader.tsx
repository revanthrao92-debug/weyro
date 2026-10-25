import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  /** Optional trailing link label, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Titled section divider for stacked dashboards — title on the left, an
 * optional tappable "See all"-style action on the right.
 */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Text style={styles.action} maxFontSizeMultiplier={2}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  action: {
    ...typography.captionMedium,
    color: palette.teal,
  },
});

export default SectionHeader;
