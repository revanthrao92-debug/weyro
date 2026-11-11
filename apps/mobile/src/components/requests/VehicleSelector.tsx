import { StyleSheet, Text, View } from 'react-native';
import { Check, Car } from 'lucide-react-native';
import { Input, PressableScale, Skeleton } from '@/components/ui';
import type { Vehicle } from '@/hooks/useProfile';
import type { ManualVehicle, RequestErrorMap } from './serviceRequestConfig';
import { fontFamilyMono, palette, spacing, typography } from '@/theme';

export type VehicleSelectorProps = {
  vehicles: Vehicle[];
  isError: boolean;
  mode: 'saved' | 'manual' | 'loading';
  selectedId: string | null;
  manual: ManualVehicle;
  errors: RequestErrorMap;
  onSelect: (id: string) => void;
  onManual: () => void;
  onSaved: () => void;
  onManualChange: (patch: Partial<ManualVehicle>) => void;
};

function vehicleLine(vehicle: Vehicle) {
  return [vehicle.year, vehicle.fuelType?.toLowerCase()].filter(Boolean).join(' · ');
}

export function VehicleSelector({
  vehicles,
  isError,
  mode,
  selectedId,
  manual,
  errors,
  onSelect,
  onManual,
  onSaved,
  onManualChange,
}: VehicleSelectorProps) {
  return (
    <View style={styles.wrap}>
      {errors.vehicle ? <Text style={styles.error}>{errors.vehicle}</Text> : null}

      {mode === 'loading' ? (
        <View style={styles.list}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={36} height={36} />
              <View style={styles.skeletonText}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="35%" height={11} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
          <PressableScale
            onPress={onManual}
            accessibilityRole="button"
            accessibilityLabel="Enter vehicle manually"
            style={styles.linkRow}
            scaleTo={0.98}
          >
            <Text style={styles.link}>Enter vehicle manually</Text>
          </PressableScale>
        </View>
      ) : null}

      {mode === 'saved' ? (
        <View style={styles.list}>
          {vehicles.map((vehicle, index) => {
            const active =
              vehicle.id === selectedId ||
              (selectedId === null && index === 0);
            return (
              <PressableScale
                key={vehicle.id}
                onPress={() => onSelect(vehicle.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${vehicle.make} ${vehicle.model}, ${vehicle.registrationNumber}`}
                scaleTo={0.99}
                style={[
                  styles.row,
                  active && styles.rowActive,
                ]}
              >
                <View style={[styles.icon, active && styles.iconActive]}>
                  <Car
                    size={17}
                    color={active ? palette.accent : palette.textMuted}
                    strokeWidth={1.8}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {vehicle.registrationNumber} · {vehicleLine(vehicle)}
                  </Text>
                </View>
                {active ? (
                  <Check size={17} color={palette.accent} strokeWidth={2.2} />
                ) : null}
              </PressableScale>
            );
          })}
          <PressableScale
            onPress={onManual}
            accessibilityRole="button"
            accessibilityLabel="Use a different vehicle"
            style={styles.linkRow}
            scaleTo={0.98}
          >
            <Text style={styles.link}>Use a different vehicle</Text>
          </PressableScale>
        </View>
      ) : null}

      {mode === 'manual' ? (
        <View style={styles.manual}>
          {isError ? (
            <Text style={styles.note}>
              Saved vehicles could not load. Enter the details manually.
            </Text>
          ) : null}
          <Input
            label="Make"
            placeholder="e.g. Maruti"
            value={manual.make}
            onChangeText={(make) => onManualChange({ make })}
            error={errors.manualMake}
            autoCapitalize="words"
          />
          <Input
            label="Model"
            placeholder="e.g. Swift"
            value={manual.model}
            onChangeText={(model) => onManualChange({ model })}
            error={errors.manualModel}
            autoCapitalize="words"
          />
          <Input
            label="Year"
            placeholder="e.g. 2021"
            value={manual.year}
            onChangeText={(year) => onManualChange({ year })}
            error={errors.manualYear}
            keyboardType="number-pad"
            maxLength={4}
          />
          {vehicles.length > 0 ? (
            <PressableScale
              onPress={onSaved}
              accessibilityRole="button"
              accessibilityLabel="Use a saved vehicle"
              style={styles.linkRow}
              scaleTo={0.98}
            >
              <Text style={styles.link}>Use a saved vehicle</Text>
            </PressableScale>
          ) : (
            <Text style={styles.note}>
              We add this vehicle to your garage so the next request is faster.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 62,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  rowActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  iconActive: { backgroundColor: palette.surface },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  rowMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  skeletonText: { flex: 1 },
  linkRow: { paddingVertical: 8 },
  link: { ...typography.label, color: palette.accent },
  manual: { gap: 0 },
  note: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  error: { ...typography.caption, color: palette.danger },
});
