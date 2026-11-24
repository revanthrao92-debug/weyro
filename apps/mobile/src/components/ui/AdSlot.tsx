import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii, typography } from '@/theme';

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
      <Text style={styles.label}>Sponsored</Text>
      <View style={styles.body}>
        <Text style={styles.note}>Your ad here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
    padding: spacing.md,
  },
  label: { ...typography.label, color: palette.textMuted },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { ...typography.caption, color: palette.textMuted },
});

export default AdSlot;
