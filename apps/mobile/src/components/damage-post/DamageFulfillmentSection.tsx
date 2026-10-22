import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DamageFulfillmentSectionProps {
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  setUrgency: (u: 'NORMAL' | 'URGENT' | 'EMERGENCY') => void;
  fulfillmentType: 'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE' | 'TOW_TO_GARAGE';
  setFulfillmentType: (
    f: 'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE' | 'TOW_TO_GARAGE',
  ) => void;
  sectionNumber?: number;
  hideServiceMode?: boolean;
}

const URGENCIES: { key: 'NORMAL' | 'URGENT' | 'EMERGENCY'; label: string; desc: string }[] = [
  { key: 'NORMAL', label: 'Standard', desc: '1 - 3 days' },
  { key: 'URGENT', label: 'Urgent ⚡', desc: 'Today / Tomorrow' },
  { key: 'EMERGENCY', label: 'Emergency 🚨', desc: 'Breakdown / Immediate' },
];

const FULFILLMENTS: {
  key: 'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE' | 'TOW_TO_GARAGE';
  label: string;
  icon: string;
}[] = [
  { key: 'PARTS_SHIPPING', label: 'Courier Parts', icon: '📦' },
  { key: 'WORKSHOP_VISIT', label: 'Garage Visit', icon: '🔧' },
  { key: 'ON_SITE', label: 'Doorstep Tech', icon: '🚐' },
  { key: 'TOW_TO_GARAGE', label: 'Tow to Garage', icon: '🚛' },
];

export function DamageFulfillmentSection({
  urgency,
  setUrgency,
  fulfillmentType,
  setFulfillmentType,
  sectionNumber = 3,
  hideServiceMode = false,
}: DamageFulfillmentSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, Elevation.low, { borderRadius: BorderRadius.large, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {sectionNumber}. URGENCY{hideServiceMode ? '' : ' & PREFERRED FULFILLMENT'}
      </ThemedText>

      <ThemedText style={styles.label}>Repair Timeline</ThemedText>
      <View style={styles.row}>
        {URGENCIES.map((u) => {
          const isSelected = urgency === u.key;
          return (
            <Pressable
              key={u.key}
              onPress={() => setUrgency(u.key)}
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
                {u.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={styles.label}>Service Mode</ThemedText>
      <View style={styles.row}>
        {!hideServiceMode && FULFILLMENTS.map((f) => {
          const isSelected = fulfillmentType === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFulfillmentType(f.key)}
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
                {f.icon} {f.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
});
