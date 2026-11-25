import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './Motion';
import { palette, spacing, typography } from '@/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Selectable chip for categories/filters. Selection shown by fill + border + weight (not color alone). */
export function Chip({ label, selected = false, onPress, accessibilityLabel }: ChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel || label}
      scaleTo={0.95}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        maxFontSizeMultiplier={2}
      >
        {label}
      </Text>
    </PressableScale>
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
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.transparent,
  },
  selected: {
    backgroundColor: palette.accentSoftBg,
    borderColor: palette.accent,
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
