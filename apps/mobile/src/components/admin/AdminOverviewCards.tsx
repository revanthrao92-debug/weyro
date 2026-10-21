import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AdminOverviewMetrics } from '@weyro/api-contracts';

interface AdminOverviewCardsProps {
  metrics: AdminOverviewMetrics;
}

export function AdminOverviewCards({ metrics }: AdminOverviewCardsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText style={styles.cardLabel} themeColor="textSecondary">
            Total Broadcasts
          </ThemedText>
          <ThemedText style={[styles.cardValue, { color: theme.primary }]}>
            {metrics.totalRequests}
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText style={styles.cardLabel} themeColor="textSecondary">
            Active Bookings
          </ThemedText>
          <ThemedText style={[styles.cardValue, { color: theme.primary }]}>
            {metrics.totalBookings}
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText style={styles.cardLabel} themeColor="textSecondary">
            Held Volume (INR)
          </ThemedText>
          <ThemedText style={[styles.cardValue, { color: theme.success }]}>
            ₹{metrics.totalEscrowVolume.toLocaleString('en-IN')}
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText style={styles.cardLabel} themeColor="textSecondary">
            Pending KYC
          </ThemedText>
          <ThemedText style={[styles.cardValue, { color: theme.warning }]}>
            {metrics.pendingVerifications}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.two,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
  },
});
