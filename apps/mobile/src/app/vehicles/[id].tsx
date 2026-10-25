import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Car } from 'lucide-react-native';
import { BackButton } from '@/components/ui';
import { useVehicles } from '@/hooks/useProfile';
import {
  ScreenContainer,
  AppHeader,
  SectionCard,
  ListItem,
  StatusPill,
  Skeleton,
  Button,
  ButtonRow,
  EmptyState,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export default function VehicleDetailScreen() {
  const { vehicleId } = useLocalSearchParams();
  const router = useRouter();
  const { data: vehicles, isLoading } = useVehicles();

  const vehicle = (vehicles?.items ?? []).find((v) => v.id === vehicleId);

  if (isLoading) {
    return (
      <ScreenContainer chrome="light">
        <AppHeader
          variant="light"
          title="Vehicle Details"
          left={<BackButton />}
        />
        <Skeleton width="100%" height={56} />
        <View style={styles.rowGap} />
        <Skeleton width="100%" height={100} />
      </ScreenContainer>
    );
  }

  if (!vehicle) {
    return (
      <ScreenContainer chrome="light">
        <AppHeader
          variant="light"
          title="Vehicle Details"
          left={<BackButton />}
        />
        <EmptyState title="Vehicle not found" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="light">
      <AppHeader
        variant="light"
        title="Vehicle Details"
        subtitle={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        left={<BackButton />}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <SectionCard title="Vehicle" icon={Car} style={styles.section}>
          <View style={styles.vehicleImage}>
            <Image source={require('../../../assets/images/weyro-logo.png')} />
          </View>
        </SectionCard>

        <SectionCard title="Vehicle Information">
          <ListItem
            bare
            divider
            title="Make & Model"
            subtitle={`${vehicle.make} ${vehicle.model}`}
          />
          <ListItem
            bare
            divider
            title="Year"
            subtitle={String(vehicle.year)}
          />
          <ListItem
            bare
            divider
            title="Registration"
            subtitle={vehicle.registrationNumber}
          />
          <ListItem
            bare
            divider
            title="Fuel Type"
            subtitle={labelize(vehicle.fuelType)}
          />
          {vehicle.vinNumber && (
            <ListItem bare title="VIN" subtitle={vehicle.vinNumber} />
          )}
          <ListItem bare title="Added" subtitle={formatDate(vehicle.createdAt)} />
        </SectionCard>

        <SectionCard title="Actions">
          <ButtonRow>
            <Button
              title="Request Service"
              onPress={() => router.push('/requests/create')}
              style={styles.flex}
            />
            <Button
              title="Service History"
              variant="secondary"
              onPress={() => router.push('/bookings')}
              style={styles.flex}
            />
          </ButtonRow>
        </SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

function labelize(value: string) {
  return value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.lg },
  rowGap: { height: spacing.sm },
  vehicleImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
