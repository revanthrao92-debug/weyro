import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RoadsideKind = 'BATTERY' | 'TYRE' | 'FUEL';

/** Flat rates mirror ROADSIDE_TARIFF in @weyro/api-contracts (INR). */
const RATE_LABEL: Record<RoadsideKind, string> = {
  BATTERY: '₹299 flat',
  TYRE: '₹399 flat',
  FUEL: '₹249 + fuel at pump rate',
};

const KINDS: { key: RoadsideKind; label: string; icon: string }[] = [
  { key: 'BATTERY', label: 'Battery', icon: '🔋' },
  { key: 'TYRE', label: 'Tyre', icon: '🛞' },
  { key: 'FUEL', label: 'Fuel', icon: '⛽' },
];

interface RoadsideDetailsSectionProps {
  kind: RoadsideKind | null;
  setKind: (kind: RoadsideKind) => void;
}

export function RoadsideDetailsSection({
  kind,
  setKind,
}: RoadsideDetailsSectionProps) {
  const theme = useTheme();

  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        What happened?
      </ThemedText>
      <View style={styles.chipRow}>
        {KINDS.map((item) => {
          const isSelected = kind === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} assist`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setKind(item.key)}
              style={[
                styles.kindChip,
                {
                  borderColor: isSelected ? theme.primary : theme.border,
                  backgroundColor: isSelected
                    ? theme.primarySurface
                    : 'transparent',
                },
              ]}>
              <ThemedText
                style={[
                  styles.kindChipText,
                  isSelected && { color: theme.primary },
                ]}>
                {`${item.icon} ${item.label}`}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {kind && (
        <ThemedText type="smallBold" style={styles.rateLabel}>
          {`Estimated: ${RATE_LABEL[kind]} (final quote from the operator may vary).`}
        </ThemedText>
      )}
    </View>
  );
}

const makeStyles = (theme: NonNullable<ReturnType<typeof useTheme>>) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    sectionTitle: {
      marginBottom: Spacing.one,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.one,
    },
    kindChip: {
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.two,
      borderRadius: BorderRadius.round,
      borderWidth: 1,
    },
    kindChipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    rateLabel: {
      marginTop: Spacing.one,
      color: theme.primary,
    },
  });
