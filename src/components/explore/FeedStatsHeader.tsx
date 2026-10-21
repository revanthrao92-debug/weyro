import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface FeedStatsHeaderProps {
  totalRequests: number;
  openRequests: number;
}

export function FeedStatsHeader({ totalRequests, openRequests }: FeedStatsHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <View style={[styles.badge, { backgroundColor: theme.primarySurface }]}>
        <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
          PROVIDER DISPATCH FEED • INDIA
        </ThemedText>
      </View>
      <ThemedText type="subtitle" style={styles.title}>
        Damage Broadcast Feed
      </ThemedText>
      <ThemedText style={styles.subtitle} themeColor="textSecondary">
        Customers upload photos of damaged car parts. Requests are broadcast to verified workshops, mechanics, and parts suppliers.
      </ThemedText>

      <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statValue, { color: theme.primary }]}>
            {openRequests}
          </ThemedText>
          <ThemedText style={styles.statLabel} themeColor="textSecondary">
            Open Requests
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statBox}>
          <ThemedText style={[styles.statValue, { color: theme.primary }]}>
            {totalRequests}
          </ThemedText>
          <ThemedText style={styles.statLabel} themeColor="textSecondary">
            Total Broadcasts
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statBox}>
          <ThemedText style={[styles.statValue, { color: theme.success }]}>
            Live
          </ThemedText>
          <ThemedText style={styles.statLabel} themeColor="textSecondary">
            Network Status
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.three,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: Spacing.one,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
});
