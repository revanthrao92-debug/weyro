import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, typography } from '@/theme';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Leading node (icon, avatar). */
  left?: ReactNode;
  /** Trailing node (chevron, value, pill). */
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * A single row for lists (settings, addresses, orders). Tappable when onPress
 * is provided; renders a chevron affordance by default via the `right` node.
 */
export function ListItem({ title, subtitle, left, right, onPress, accessibilityLabel }: ListItemProps) {
  const content = (
    <>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.body}>
        <Text style={styles.title} maxFontSizeMultiplier={2} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={2} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.surface,
    // Divider-separated rows (not floating cards): a clear 1px line between
    // sections is what reads as separation on device.
    borderBottomWidth: 1,
    borderBottomColor: palette.borderStrong,
  },
  pressed: {
    backgroundColor: palette.surfaceAlt,
  },
  left: {
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  right: {
    marginLeft: spacing.md,
  },
  title: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
});

export default ListItem;
