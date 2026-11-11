import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BackButton,
  ScreenContainer,
  Button,
  Skeleton,
  EmptyState,
  SectionHead,
} from '@/components/ui';
import { useVehicles } from '@/hooks/useProfile';
import {
  palette,
  spacing,
  radii,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { carPhotoFor } from '@/lib/photos';
import { formatDate, labelize } from '@/utils/format';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: vehicles, isLoading } = useVehicles();

  const vehicle = (vehicles?.items ?? []).find((v) => v.id === id);

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <BackButton />
        <Skeleton width="55%" height={28} style={{ marginTop: spacing.md }} />
        <Skeleton width="100%" height={200} style={{ marginTop: spacing.lg }} />
      </ScreenContainer>
    );
  }

  if (!vehicle) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <BackButton />
        <EmptyState title="Vehicle not found" message="This vehicle may have been removed." />
      </ScreenContainer>
    );
  }

  const serviceTitle = `Service for ${vehicle.make} ${vehicle.model}`;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.topLabel}>Garage</Text>
          <View style={styles.spacer} />
        </View>

        <Image
          source={{ uri: carPhotoFor(vehicle.make, vehicle.model) }}
          style={styles.hero}
          contentFit="cover"
          transition={150}
        />
        <Text style={styles.title}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text style={styles.plate}>{vehicle.registrationNumber}</Text>

        <SectionHead title="Vehicle" />
        <View style={styles.spec}>
          {[
            ['Year', String(vehicle.year)],
            ['Registration', vehicle.registrationNumber],
            ['Fuel', labelize(vehicle.fuelType)],
            ...(vehicle.vinNumber ? [['VIN', vehicle.vinNumber] as [string, string]] : []),
            ['Added', formatDate(vehicle.createdAt)],
          ].map(([label, value], i) => (
            <View key={label} style={[styles.specRow, i > 0 && styles.divider]}>
              <Text style={styles.specLabel}>{label}</Text>
              <Text style={styles.specValue}>{value}</Text>
            </View>
          ))}
        </View>

        <SectionHead title="Actions" />
        <View style={styles.actions}>
          <Button
            title="Request service"
            onPress={() =>
              router.push(
                `/requests/create?category=MAINTENANCE&title=${encodeURIComponent(serviceTitle)}`
              )
            }
          />
          <Button
            title="Service history"
            variant="secondary"
            onPress={() => router.push('/bookings')}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  topLabel: { ...typography.label, color: palette.textMuted },
  spacer: { width: 44 },
  hero: {
    width: '100%',
    height: 210,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: palette.textPrimary,
    marginTop: spacing.lg,
  },
  plate: {
    fontFamily: fontFamilyMono,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 4,
  },
  spec: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  specLabel: { ...typography.caption, color: palette.textSecondary },
  specValue: {
    ...typography.captionMedium,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  actions: { gap: spacing.sm },
});
