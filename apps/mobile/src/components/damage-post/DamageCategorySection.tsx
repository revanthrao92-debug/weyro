import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ServiceCategory } from '@weyro/api-contracts';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PostServiceCategory = ServiceCategory;

const CATEGORIES: {
  key: PostServiceCategory;
  label: string;
  icon: string;
}[] = [
  { key: 'REPAIR', label: 'Repair', icon: '🛠️' },
  { key: 'MAINTENANCE', label: 'Maintenance', icon: '🧰' },
  { key: 'SPARE_PART', label: 'Spare Parts', icon: '📦' },
  { key: 'TOWING', label: 'Towing', icon: '🚛' },
  { key: 'ROADSIDE', label: 'Roadside', icon: '🆘' },
  { key: 'INSPECTION', label: 'Inspection', icon: '🔍' },
];

interface DamageCategorySectionProps {
  category: PostServiceCategory;
  setCategory: (category: PostServiceCategory) => void;
}

export function DamageCategorySection({
  category,
  setCategory,
}: DamageCategorySectionProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.section,
        Elevation.low,
        { borderRadius: BorderRadius.large, backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        1. SERVICE CATEGORY
      </ThemedText>

      <View style={styles.chipsContainer}>
        {CATEGORIES.map((item) => {
          const isSelected = category === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} service category`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setCategory(item.key)}
              style={[
                styles.chip,
                { borderColor: isSelected ? theme.primary : theme.border },
                isSelected && { backgroundColor: theme.primarySurface },
              ]}>
              <ThemedText
                style={[
                  styles.chipText,
                  isSelected && { color: theme.primary, fontWeight: '700' },
                ]}>
                {item.icon} {item.label}
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
});
