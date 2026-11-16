import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale, SectionHead as Head } from '@/components/ui';
import { palette } from '@/theme';
import { carPhotoFor } from '@/lib/photos';

import type { useRouter } from 'expo-router';
import type { Vehicle } from '@/hooks/useProfile';
import { styles } from './styles';

export function VehicleSection({ router, vehicle, vehicles }: {
  router: ReturnType<typeof useRouter>;
  vehicle: Vehicle | undefined;
  vehicles: Vehicle[];
}) {
  return (
    <>
      {/* Vehicle */}
      <Head
        index="02"
        title="Your vehicle"
        action={vehicles.length ? 'All vehicles' : undefined}
        onAction={() => router.push('/vehicles')}
      />
      {vehicle ? (
        <PressableScale
          onPress={() => router.push(`/vehicles/${vehicle.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${vehicle.make} ${vehicle.model}`}
          scaleTo={0.99}
          style={styles.vehicleRow}
        >
          <Image
            source={{ uri: carPhotoFor(vehicle.make, vehicle.model) }}
            style={styles.vehicleThumb}
            contentFit="cover"
            transition={150}
          />
          <View style={styles.vehicleText}>
            <Text style={styles.vehicleName} numberOfLines={1}>
              {vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.vehiclePlate}>
              {vehicle.registrationNumber} · {vehicle.year}
            </Text>
          </View>
          <Text style={styles.vehicleAction}>Book service</Text>
        </PressableScale>
      ) : (
        <PressableScale
          onPress={() => router.push('/vehicles')}
          accessibilityRole="button"
          accessibilityLabel="Add your vehicle"
          scaleTo={0.99}
          style={styles.addVehicle}
        >
          <Text style={styles.addVehicleText}>Add your vehicle to get accurate quotes</Text>
          <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
        </PressableScale>
      )}
    </>
  );
}
