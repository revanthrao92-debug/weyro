import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  type Vehicle,
} from '@/hooks/useProfile';
import {
  Input,
  Button,
  ScreenContainer,
  AppHeader,
  Card,
  EmptyState,
  Skeleton,
  ButtonRow,
  Chip,
  BackButton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'];

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace('_', ' ');
}

export default function VehiclesScreen() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();

  const [showAdd, setShowAdd] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [reg, setReg] = useState('');
  const [vin, setVin] = useState('');
  const [fuel, setFuel] = useState('PETROL');
  const [color, setColor] = useState('');
  const [adding, setAdding] = useState(false);

  const vehicles = data?.items ?? [];

  const handleAddVehicle = async () => {
    if (!make || !model || !year || !reg) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setAdding(true);
    try {
      await createVehicle.mutateAsync({
        make,
        model,
        year: parseInt(year, 10),
        registrationNumber: reg,
        vinNumber: vin || undefined,
        fuelType: fuel as any,
        color: color || undefined,
      });
      setShowAdd(false);
      setMake('');
      setModel('');
      setYear('');
      setReg('');
      setVin('');
      setFuel('PETROL');
      setColor('');
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to add vehicle');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete Vehicle',
        'Are you sure you want to remove this vehicle?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;
    try {
      await deleteVehicle.mutateAsync(id);
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to delete vehicle');
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader left={<BackButton />} title="My Vehicles" subtitle="Manage your garage" />
        {[0, 1, 2].map((i) => (
          <VehicleSkeleton key={i} />
        ))}
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer>
        <AppHeader left={<BackButton />} title="My Vehicles" subtitle="Manage your garage" />

        {vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles saved"
            message="Add your first vehicle to get started."
            action={
              <Button title="Add vehicle" onPress={() => setShowAdd(true)} />
            }
          />
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <VehicleItem item={item} onDelete={handleDeleteVehicle} />
            )}
          />
        )}

        <Button
          title="Add vehicle"
          onPress={() => setShowAdd(true)}
          style={styles.fabBtn}
        />

        {showAdd && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalOverlay} />
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Card style={styles.modalCard}>
                <Text style={styles.modalTitle}>Add Vehicle</Text>
                <Input
                  label="Make"
                  placeholder="e.g. Maruti"
                  value={make}
                  onChangeText={setMake}
                />
                <Input
                  label="Model"
                  placeholder="e.g. Swift"
                  value={model}
                  onChangeText={setModel}
                />
                <Input
                  label="Year"
                  placeholder="e.g. 2021"
                  value={year}
                  onChangeText={setYear}
                  keyboardType="numeric"
                />
                <Input
                  label="Registration Number"
                  placeholder="e.g. KA01AB1234"
                  value={reg}
                  onChangeText={setReg}
                  autoCapitalize="characters"
                />
                <Input
                  label="VIN Number (optional)"
                  placeholder="VIN"
                  value={vin}
                  onChangeText={setVin}
                />
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Fuel Type</Text>
                </View>
                <View style={styles.fuelSelector}>
                  {FUEL_TYPES.map((f) => (
                    <Chip
                      key={f}
                      label={labelize(f)}
                      selected={fuel === f}
                      onPress={() => setFuel(f as any)}
                    />
                  ))}
                </View>
                <Input
                  label="Color (optional)"
                  placeholder="Color"
                  value={color}
                  onChangeText={setColor}
                />
                <ButtonRow vertical>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setShowAdd(false)}
                  />
                  <Button
                    title="Add Vehicle"
                    disabled={adding}
                    loading={adding}
                    onPress={handleAddVehicle}
                  />
                </ButtonRow>
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function VehicleSkeleton() {
  return (
    <View style={styles.skeletonItem}>
      <Skeleton width="45%" height={18} />
      <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
      <Skeleton width="60%" height={12} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

function VehicleItem({ item, onDelete }: { item: Vehicle; onDelete: (id: string) => void }) {
  return (
    <TouchableOpacity
      style={styles.itemTouch}
      onPress={() => {}}
      accessibilityRole="button"
      accessibilityLabel={`Vehicle ${item.make} ${item.model} ${item.year}`}
    >
      <Card style={styles.item}>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{item.make} {item.model} ({item.year})</Text>
          <Text style={styles.itemReg}>{item.registrationNumber}</Text>
          <Text style={styles.itemMeta}>
            {labelize(item.fuelType)} • {item.color || 'N/A'}
          </Text>
        </View>
        <TouchableOpacity style={styles.removeButton} onPress={() => onDelete(item.id)} accessibilityLabel={`Remove ${item.make} ${item.model}`}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  list: { paddingBottom: spacing.xxl },
  skeletonItem: { marginBottom: spacing.md },
  itemTouch: { marginBottom: spacing.md },
  item: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  itemReg: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  itemMeta: { ...typography.label, color: palette.textMuted, marginTop: spacing.xs },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: palette.dangerSoftBg,
    backgroundColor: palette.dangerSoftBg,
  },
  removeText: {
    ...typography.label,
    color: palette.danger,
  },
  fabBtn: {
    alignSelf: 'flex-start',
    minWidth: 140,
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.overlay,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.overlay,
  },
  modalScroll: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { ...typography.heading, color: palette.textPrimary },
  labelRow: { marginBottom: spacing.sm },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  fuelSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  fuelOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
  },
  fuelOptionSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  fuelText: { ...typography.captionMedium, color: palette.textPrimary },
  modalActions: { gap: spacing.md },
});
