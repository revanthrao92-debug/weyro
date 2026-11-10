import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii, typography, fontFamilyMono } from '@/theme';

export interface AdSlotProps {
  /** Reserved height in pt (standard banner ≈ 100). */
  height?: number;
  /** Placement id for future ad SDK integration. */
  placement?: string;
}

/**
 * Reserved advertising space.
 *
 * Deliberately visible and labelled until a real ad network is wired: this is
 * the one dedicated slot on a screen. Swapping to AdMob later means rendering
 * the network banner inside this box — the layout contract stays the same.
 */
export function AdSlot({ height = 100, placement = 'home-sponsored' }: AdSlotProps) {
  return (
    <View
      style={[styles.box, { height }]}
      accessibilityRole="text"
      accessibilityLabel="Advertising space, reserved for a sponsored placement"
      testID={`ad-slot-${placement}`}
    >
      <Text style={styles.label}>Ad space</Text>
      <Text style={styles.note}>Reserved for a sponsored placement</Text>
      <Text style={styles.meta}>320 × 100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    ...typography.label,
    color: palette.textSecondary,
    letterSpacing: 0.6,
  },
  note: {
    ...typography.label,
    color: palette.textMuted,
  },
  meta: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
  },
});

export default AdSlot;
