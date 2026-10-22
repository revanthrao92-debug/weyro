import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TowingVehicleType =
  | 'FLATBED'
  | 'HOOK_AND_CHAIN'
  | 'MOTORCYCLE'
  | 'ANY';

const EQUIPMENT: { key: TowingVehicleType; label: string; icon: string }[] = [
  { key: 'FLATBED', label: 'Flatbed', icon: '🛻' },
  { key: 'HOOK_AND_CHAIN', label: 'Hook & Chain', icon: '⛓️' },
  { key: 'MOTORCYCLE', label: 'Motorcycle', icon: '🏍️' },
  { key: 'ANY', label: 'Any', icon: '🚛' },
];

interface TowingDetailsSectionProps {
  vehicleType: TowingVehicleType;
  setVehicleType: (type: TowingVehicleType) => void;
  dropoffAddress: string;
  setDropoffAddress: (address: string) => void;
  vehicleWeightKg: string;
  setVehicleWeightKg: (weight: string) => void;
  onEstimate: () => Promise<{ distanceKm: number; fare: number } | null>;
}

export function TowingDetailsSection({
  vehicleType,
  setVehicleType,
  dropoffAddress,
  setDropoffAddress,
  vehicleWeightKg,
  setVehicleWeightKg,
  onEstimate,
}: TowingDetailsSectionProps) {
  const theme = useTheme();
  const [estimate, setEstimate] = useState<{
    distanceKm: number;
    fare: number;
  } | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const handleEstimate = async () => {
    setIsEstimating(true);
    try {
      const result = await onEstimate();
      setEstimate(result);
    } catch {
      setEstimate(null);
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <View
      style={[
        styles.section,
        Elevation.low,
        {
          borderRadius: BorderRadius.large,
          backgroundColor: theme.backgroundElement,
        },
      ]}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        3. TOWING DETAILS
      </ThemedText>

      <ThemedText style={styles.label}>Towing Equipment Needed</ThemedText>
      <View style={styles.row}>
        {EQUIPMENT.map((item) => {
          const isSelected = vehicleType === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setVehicleType(item.key)}
              style={[
                styles.pill,
                { borderColor: isSelected ? theme.primary : theme.border },
                isSelected && { backgroundColor: theme.primarySurface },
              ]}>
              <ThemedText
                style={[
                  styles.pillText,
                  isSelected && { color: theme.primary, fontWeight: '700' },
                ]}>
                {item.icon} {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={styles.label}>Dropoff Address</ThemedText>
      <TextInput
        accessibilityLabel="Dropoff address"
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
        placeholder="Where should the vehicle be towed?"
        placeholderTextColor={theme.textSecondary}
        value={dropoffAddress}
        onChangeText={(value) => {
          setDropoffAddress(value);
          setEstimate(null);
        }}
        multiline
      />

      <ThemedText style={styles.label}>
        Vehicle Weight (kg, optional)
      </ThemedText>
      <TextInput
        accessibilityLabel="Vehicle weight in kilograms"
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
        placeholder="Helps match a tow truck with enough capacity"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        value={vehicleWeightKg}
        onChangeText={setVehicleWeightKg}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Estimate towing fare"
        disabled={isEstimating || dropoffAddress.trim().length < 3}
        onPress={handleEstimate}
        style={[
          styles.estimateBtn,
          { borderColor: theme.primary },
          (isEstimating || dropoffAddress.trim().length < 3) && {
            opacity: 0.5,
          },
        ]}>
        {isEstimating ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <ThemedText style={[styles.estimateText, { color: theme.primary }]}>
            Estimate Tow Fare
          </ThemedText>
        )}
      </Pressable>

      {estimate && (
        <ThemedText style={styles.estimateResult}>
          ~{estimate.distanceKm.toFixed(1)} km · ₹
          {estimate.fare.toLocaleString('en-IN')} estimated
        </ThemedText>
      )}
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  pill: {
    flexGrow: 1,
    flexBasis: '30%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: Spacing.two,
  },
  estimateBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  estimateResult: {
    fontSize: 13,
    marginTop: Spacing.two,
    textAlign: 'center',
  },
});
