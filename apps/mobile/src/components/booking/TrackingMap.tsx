import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing, radii, typography } from '@/theme';

export type TrackingMapProps = {
  providerLocation?: { latitude: number; longitude: number };
  customerLocation?: { latitude: number; longitude: number };
};

export function TrackingMap({ providerLocation, customerLocation }: TrackingMapProps) {
  return (
    <View style={[styles.container, { borderColor: palette.border }]}>
      <Text style={styles.label}>Map placeholder</Text>
      {providerLocation && (
        <Text style={styles.coords}>
          Provider: {providerLocation.latitude.toFixed(4)}, {providerLocation.longitude.toFixed(4)}
        </Text>
      )}
      {customerLocation && (
        <Text style={styles.coords}>
          You: {customerLocation.latitude.toFixed(4)}, {customerLocation.longitude.toFixed(4)}
        </Text>
      )}
      <Text style={styles.hint}>
        Install react-native-maps and configure Google Maps API for live tracking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  coords: {
    ...typography.caption,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.md,
  },
});
