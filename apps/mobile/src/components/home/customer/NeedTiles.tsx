import { StyleSheet, Text, View } from 'react-native';
import { Car, LifeBuoy, Package, Wrench, type LucideIcon } from 'lucide-react-native';
import type { useRouter } from 'expo-router';
import { PressableScale, Pulse, SectionHead } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { palette, radii, spacing, typography } from '@/theme';

type Tile = { label: string; detail: string; Icon: LucideIcon; go: string; urgent?: boolean };

/** "What do you need?": four doors instead of a long list (Repair, Maintenance and Inspection share one request form). */
const TILES: Tile[] = [
  { label: 'Repair & service', detail: 'Dents, servicing', Icon: Wrench, go: '/requests/create' },
  { label: 'Spare parts', detail: 'Genuine and used', Icon: Package, go: '/shop' },
  { label: 'Roadside SOS', detail: 'Tow, battery, tyre, fuel', Icon: LifeBuoy, go: '/sos', urgent: true },
  { label: 'Driver Go', detail: 'A driver for your car', Icon: Car, go: '/driver-go' },
];

export function NeedTiles({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <View>
      <SectionHead title="What do you need?" />
      <View style={styles.grid}>
        {TILES.map(({ label, detail, Icon, go, urgent }) => {
          const tile = (
            <PressableScale
              onPress={() => {
                if (urgent) haptics.heavy();
                router.push(go as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
              scaleTo={0.96}
              style={[styles.tile, urgent && styles.tileUrgent]}
            >
              <Icon size={24} color={urgent ? palette.sosIcon : palette.accent} strokeWidth={1.9} />
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.detail} numberOfLines={1}>
                {detail}
              </Text>
            </PressableScale>
          );
          return (
            <View key={label} style={styles.cell}>
              {urgent ? <Pulse color={palette.sos} radius={radii.lg}>{tile}</Pulse> : tile}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '48%', flexGrow: 1 },
  tile: {
    minHeight: 116,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  tileUrgent: { borderColor: palette.sos, backgroundColor: palette.sosSoftBg },
  label: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: spacing.md },
  detail: { ...typography.label, color: palette.textMuted, marginTop: 2 },
});
