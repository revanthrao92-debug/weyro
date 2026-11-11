import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { PressableScale } from '@/components/ui';
import type { PickedLocation } from './types';
import {
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

export type LocationFieldProps = {
  label: string;
  value?: PickedLocation | null;
  placeholder: string;
  onPress: () => void;
  error?: string;
  hint?: string;
};

/** A location as a form field — never exposes latitude/longitude. */
export function LocationField({
  label,
  value,
  placeholder,
  onPress,
  error,
  hint,
}: LocationFieldProps) {
  const filled = Boolean(value?.address);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${filled ? value?.address : placeholder}`}
        scaleTo={0.99}
        style={[styles.field, error ? styles.fieldError : null]}
      >
        <View style={[styles.icon, filled && styles.iconFilled]}>
          <MapPin
            size={15}
            color={filled ? palette.accent : palette.textMuted}
            strokeWidth={2}
          />
        </View>
        <View style={styles.text}>
          <Text
            style={[styles.value, !filled && styles.placeholder]}
            numberOfLines={2}
          >
            {filled ? value?.address : placeholder}
          </Text>
          {value?.label && filled ? (
            <Text style={styles.meta} numberOfLines={1}>
              {value.label}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
      </PressableScale>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    ...typography.label,
    color: palette.textSecondary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  fieldError: { borderColor: palette.danger },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  iconFilled: { backgroundColor: palette.accentSoftBg },
  text: { flex: 1 },
  value: { ...typography.body, color: palette.textPrimary },
  placeholder: { color: palette.textMuted },
  meta: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    marginTop: 2,
  },
  error: { ...typography.caption, color: palette.danger },
  hint: { ...typography.caption, color: palette.textMuted },
});
