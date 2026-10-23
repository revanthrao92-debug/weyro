import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import { Input } from '@/components/ui/Input';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Vehicles</Text>
        <Text style={styles.subtitle}>
          Manage your garage
        </Text>
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.empty}>
          <Text>No vehicles saved</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAdd(true)}>
            <Text style={styles.emptyButtonText}>Add your first vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VehicleItem item={item} onDelete={handleDeleteVehicle} />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Vehicle</Text>
            <View style={styles.modalForm}>
              <Input
                style={styles.input}
                placeholder="Make (e.g. Maruti)"
                value={make}
                onChangeText={setMake}
              />
              <Input
                style={styles.input}
                placeholder="Model (e.g. Swift)"
                value={model}
                onChangeText={setModel}
              />
              <Input
                style={styles.input}
                placeholder="Year (e.g. 2021)"
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
              />
              <Input
                style={styles.input}
                placeholder="Registration Number (e.g. KA01AB1234)"
                value={reg}
                onChangeText={setReg}
                autoCapitalize="characters"
              />
              <Input
                style={styles.input}
                placeholder="VIN Number (optional)"
                value={vin}
                onChangeText={setVin}
              />
              <Text style={styles.label}>Fuel Type</Text>
              <View style={styles.fuelSelector}>
                {['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.fuelOption,
                      fuel === f && styles.fuelOptionSelected,
                    ]}
                    onPress={() => setFuel(f as any)}
                  >
                    <Text style={styles.fuelText}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                style={styles.input}
                placeholder="Color (optional)"
                value={color}
                onChangeText={setColor}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAdd(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddVehicle}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveText}>Add Vehicle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function VehicleItem({ item, onDelete }: { item: Vehicle; onDelete: (id: string) => void }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>
          {item.make} {item.model} ({item.year})
        </Text>
        <Text style={styles.itemReg}>{item.registrationNumber}</Text>
        <Text style={styles.itemMeta}>
          {item.fuelType} • {item.color || 'N/A'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onDelete(item.id)}
      >
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#208AEF',
    backgroundColor: '#FFFFFF',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#208AEF',
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itemReg: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },
  modalForm: {
    gap: 16,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  fuelSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  fuelOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  fuelOptionSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#EFF6FF',
  },
  fuelText: {
    fontSize: 14,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  cancelText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#208AEF',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
} as any;
