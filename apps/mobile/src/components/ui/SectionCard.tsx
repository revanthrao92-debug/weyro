import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from './ScreenContainer';
import { Badge } from './Badge';
import { palette, spacing, typography } from '@/theme';

export interface SectionCardProps {
  title: string;
  /** Small leading icon for the section identity. */
  icon?: LucideIcon;
  /** Optional count rendered as a badge next to the title. */
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  /** Tap on the header — usually opens the section's list screen. */
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
}

/**
 * A dashboard section: one white Card containing a tappable header (icon,
 * title, optional count, optional action label) and embedded content rows.
 * Polish lives at the section level so the page canvas stays quiet.
 */
export function SectionCard({
  title,
  icon: Icon,
  count,
  actionLabel,
  onAction,
  onPress,
  style,
  children,
}: SectionCardProps) {
  const header = (
    <View style={styles.headerRow}>
      {Icon ? <Icon size={18} color={palette.teal} strokeWidth={2} /> : null}
      <Text style={styles.title} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      {count ? <Badge value={count} tone="neutral" /> : null}
      <View style={styles.spacer} />
      {actionLabel ? (
        <Text style={styles.action} maxFontSizeMultiplier={2}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Card style={style}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ? `${title}, ${actionLabel}` : title}
          hitSlop={4}
          className="active:opacity-60"
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  spacer: { flex: 1 },
  action: {
    ...typography.captionMedium,
    color: palette.teal,
  },
  body: {
    marginTop: spacing.xs,
  },
});

export default SectionCard;
