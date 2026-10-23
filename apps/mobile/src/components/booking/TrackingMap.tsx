import { View, Text, StyleSheet } from 'react-native';

export type TrackingMapProps = {
  providerLocation?: { latitude: number; longitude: number };
  customerLocation?: { latitude: number; longitude: number };
};

export function TrackingMap({ providerLocation, customerLocation }: TrackingMapProps) {
  return (
    <View style={[styles.container, { borderColor: '#E5E7EB' }]}>
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
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  coords: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
