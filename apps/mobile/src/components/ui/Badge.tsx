import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii, typography } from '@/theme';

export interface BadgeProps {
  /** Count or short label to display. */
  value: number | string;
  tone?: 'accent' | 'neutral';
}

/**
 * Small count/label badge (e.g. unread notifications). Not used as the sole
 * carrier of meaning — always paired with context at the call site.
 */
export function Badge({ value, tone = 'accent' }: BadgeProps) {
  const isAccent = tone === 'accent';
  return (
    <View
      style={[styles.badge, isAccent ? styles.accent : styles.neutral]}
      accessibilityRole="text"
      accessibilityLabel={`Badge: ${value}`}
    >
      <Text
        style={[styles.text, { color: isAccent ? palette.onAccent : palette.textSecondary }]}
        maxFontSizeMultiplier={2}
      >
        {String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accent: {
    backgroundColor: palette.accent,
  },
  neutral: {
    backgroundColor: palette.surfaceAlt,
  },
  text: {
    ...typography.label,
    fontSize: 11,
  },
});

export default Badge;
