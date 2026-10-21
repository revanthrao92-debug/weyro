import React from 'react';
import { StyleSheet, TextInput, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const COMMON_DAMAGED_PARTS = [
  'Front Bumper & Grille',
  'Headlight / Lamp Unit',
  'Side Door & Panel',
  'Radiator & Cooling',
  'Windshield & Glass',
  'Suspension & Axle',
  'Engine Compartment',
  'Rear Bumper & Boot',
];

interface DamageVehicleSectionProps {
  vehicleMake: string;
  setVehicleMake: (v: string) => void;
  vehicleModel: string;
  setVehicleModel: (v: string) => void;
  vehicleYear: string;
  setVehicleYear: (v: string) => void;
  selectedPart: string;
  setSelectedPart: (p: string) => void;
  description: string;
  setDescription: (d: string) => void;
}

export function DamageVehicleSection({
  vehicleMake,
  setVehicleMake,
  vehicleModel,
  setVehicleModel,
  vehicleYear,
  setVehicleYear,
  selectedPart,
  setSelectedPart,
  description,
  setDescription,
}: DamageVehicleSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, Elevation.low, { borderRadius: BorderRadius.large, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        1. VEHICLE DETAILS & DAMAGED PART
      </ThemedText>

      <View style={styles.row}>
        <View style={styles.flex2}>
          <ThemedText style={styles.inputLabel}>Make</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. Maruti Suzuki, Hyundai, Tata"
            placeholderTextColor={theme.textSecondary}
            value={vehicleMake}
            onChangeText={setVehicleMake}
          />
        </View>
        <View style={styles.flex2}>
          <ThemedText style={styles.inputLabel}>Model</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. Swift, Creta, Nexon"
            placeholderTextColor={theme.textSecondary}
            value={vehicleModel}
            onChangeText={setVehicleModel}
          />
        </View>
        <View style={styles.flex1}>
          <ThemedText style={styles.inputLabel}>Year</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="2024"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={vehicleYear}
            onChangeText={setVehicleYear}
          />
        </View>
      </View>

      <ThemedText style={styles.inputLabel}>Select Damaged Component</ThemedText>
      <View style={styles.chipsContainer}>
        {COMMON_DAMAGED_PARTS.map((part) => {
          const isSelected = selectedPart === part;
          return (
            <Pressable
              key={part}
              onPress={() => setSelectedPart(part)}
              style={[
                styles.partChip,
                { borderColor: isSelected ? theme.primary : theme.border },
                isSelected && { backgroundColor: theme.primarySurface },
              ]}>
              <ThemedText
                style={[
                  styles.chipText,
                  isSelected && { color: theme.primary, fontWeight: '700' },
                ]}>
                {part}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={styles.inputLabel}>Damage Description</ThemedText>
      <TextInput
        style={[
          styles.textArea,
          { borderColor: theme.border, color: theme.text },
        ]}
        placeholder="Describe the damage, symptoms, or specific replacement part needed..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.four,
    padding: Spacing.three,
  },
  sectionTitle: {
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  partChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
});
