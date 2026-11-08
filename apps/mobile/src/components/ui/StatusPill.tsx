import { StyleSheet, Text, View } from 'react-native';
import { statusColors, StatusTone, spacing, radii, typography } from '@/theme';

export interface StatusPillProps {
  /** Human-readable status text — never rely on color alone. */
  label: string;
  tone?: StatusTone;
}

/**
 * Compact status indicator. Color is ALWAYS paired with a text label so status
 * is never conveyed by color alone (WCAG). Tones map to muted theme colors.
 */
export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const { fg, bg } = statusColors[tone];
  return (
    <View
      style={[styles.pill, { backgroundColor: bg }]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    ...typography.label,
  },
});

export default StatusPill;
