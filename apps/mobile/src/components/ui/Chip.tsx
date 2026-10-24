import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii, typography } from '@/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Selectable chip for categories/filters. Selection shown by fill + border + weight (not color alone). */
export function Chip({ label, selected = false, onPress, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        maxFontSizeMultiplier={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface FilterChipsProps {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (value: string) => void;
}

/** Horizontal row of exclusive filter chips. */
export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  return (
    <View style={styles.row}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={opt.value === value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    // borderStrong: plain `border` was invisible (white chips on off-white canvas)
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  selected: {
    backgroundColor: palette.accentSoftBg,
    borderColor: palette.accent,
  },
  pressed: {
    backgroundColor: palette.surfaceAlt,
  },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
  },
  labelSelected: {
    color: palette.accent,
  },
});

export default Chip;
