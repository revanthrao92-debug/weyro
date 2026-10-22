import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHistoryList } from '@/hooks/use-history-list';
import { apiClient } from '@/services/api-client';

interface ActivityDay {
  date: string;
  requests: number;
  bookings: number;
  quotations: number;
  sparePartOrders: number;
}

interface ActivityStats {
  days: ActivityDay[];
  totals: { users: number; providers: number };
}

interface AuditLogItem {
  id: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const stamp = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const statLabel = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

export default function AdminTrafficScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = () => {
    setStatsError(null);
    apiClient
      .get<ActivityStats>('/admin/activity-stats')
      .then(setStats)
      .catch((err: any) =>
        setStatsError(err?.message || 'Unable to load traffic stats.'),
      );
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats();
  }, []);

  const fetcher = useMemo(
    () => async (cursor: string | null) => {
      return apiClient.get<{ items: AuditLogItem[]; nextCursor: string | null }>(
        '/admin/activity-logs',
        { params: { cursor: cursor ?? undefined, limit: 20 } },
      );
    },
    [],
  );

  const { items, isLoading, isLoadingMore, error, hasMore, loadMore, retry } =
    useHistoryList<AuditLogItem>({ fetch: fetcher, key: 'logs' });

  const styles = makeStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, { maxWidth: MaxContentWidth }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}>
              <ThemedText style={styles.backText}>‹</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              Activity & Traffic
            </ThemedText>
          </View>

          {/* Traffic snapshot */}
          <ThemedText type="smallBold" style={styles.sectionLabel}>
            7-DAY TRAFFIC
          </ThemedText>
          {statsError ? (
            <View style={styles.block}>
              <ThemedText type="small" style={styles.error} themeColor="danger">
                {statsError}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reload traffic stats"
                onPress={loadStats}
                style={styles.retryBtn}>
                <ThemedText type="small" style={styles.retryText}>
                  Reload
                </ThemedText>
              </Pressable>
            </View>
          ) : !stats ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.statsRow}>
                {stats.days.map((day) => (
                  <View key={day.date} style={styles.statCard}>
                    <ThemedText type="small" style={styles.statDay}>
                      {statLabel(day.date)}
                    </ThemedText>
                    <ThemedText type="smallBold" style={styles.statNumber}>
                      {day.requests + day.bookings + day.quotations + day.sparePartOrders}
                    </ThemedText>
                    <ThemedText type="small" style={styles.statBreak}>
                      Req {day.requests} · Jobs {day.bookings}
                    </ThemedText>
                    <ThemedText type="small" style={styles.statBreak}>
                      Quotes {day.quotations} · Parts {day.sparePartOrders}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {stats && (
            <View style={styles.totalsRow}>
              <View style={styles.totalsCard}>
                <ThemedText type="smallBold" style={styles.statNumber}>
                  {stats.totals.users}
                </ThemedText>
                <ThemedText type="small" style={styles.summaryLabel}>
                  Users
                </ThemedText>
              </View>
              <View style={styles.totalsCard}>
                <ThemedText type="smallBold" style={styles.statNumber}>
                  {stats.totals.providers}
                </ThemedText>
                <ThemedText type="small" style={styles.summaryLabel}>
                  Dealers
                </ThemedText>
              </View>
            </View>
          )}

          {/* Audit trail */}
          <ThemedText type="smallBold" style={styles.sectionLabel}>
            ACTIVITY LOGS (AUDIT TRAIL)
          </ThemedText>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.block}>
              <ThemedText type="small" style={styles.error} themeColor="danger">
                {error}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading audit logs"
                onPress={retry}
                style={styles.retryBtn}>
                <ThemedText type="small" style={styles.retryText}>
                  Try Again
                </ThemedText>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.block}>
              <ThemedText type="small" style={styles.summaryLabel}>
                No audit events recorded yet.
              </ThemedText>
            </View>
          ) : (
            items.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <ThemedText type="smallBold" style={styles.logAction}>
                    {log.action}
                  </ThemedText>
                  <ThemedText type="small" style={styles.logStamp}>
                    {stamp(log.createdAt)}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={styles.logLine}>
                  {log.actorRole || 'SYSTEM'} → {log.entityType}
                  {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}
                </ThemedText>
                {log.ipAddress && (
                  <ThemedText type="small" style={styles.logLine}>
                    IP {log.ipAddress}
                  </ThemedText>
                )}
              </View>
            ))
          )}

          {isLoadingMore && (
            <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.two }} />
          )}
          {!isLoadingMore && !error && hasMore && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Load more audit logs"
              onPress={() => loadMore()}
              style={styles.loadMoreBtn}>
              <ThemedText type="smallBold" style={styles.loadMoreText}>
                Load 20 More Logs
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: NonNullable<ReturnType<typeof useTheme>>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.three,
    },
    inner: {
      width: '100%',
      alignSelf: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.two,
    },
    backBtn: {
      paddingVertical: Spacing.one,
      paddingRight: Spacing.two,
    },
    backText: {
      fontSize: 18,
      color: theme.primary,
    },
    headerTitle: {
      fontSize: 17,
      color: theme.text,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: theme.textSecondary,
      marginTop: Spacing.two,
      marginBottom: Spacing.one,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    statCard: {
      width: 150,
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.two,
    },
    statDay: {
      color: theme.textSecondary,
      marginBottom: 2,
    },
    statNumber: {
      fontSize: 20,
      color: theme.text,
    },
    statBreak: {
      color: theme.textSecondary,
      fontSize: 10,
      marginTop: 2,
    },
    totalsRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginTop: Spacing.two,
    },
    totalsCard: {
      flex: 1,
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: Spacing.two,
      alignItems: 'center',
    },
    summaryLabel: {
      color: theme.textSecondary,
    },
    block: {
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.two,
      marginBottom: Spacing.two,
    },
    logCard: {
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.two,
      marginBottom: Spacing.two,
      ...Elevation.low,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.one,
    },
    logAction: {
      color: theme.text,
      flexShrink: 1,
    },
    logStamp: {
      color: theme.textSecondary,
      fontSize: 10,
    },
    logLine: {
      color: theme.textSecondary,
      marginTop: 2,
    },
    center: {
      paddingVertical: Spacing.three,
      alignItems: 'center',
    },
    error: {
      marginBottom: Spacing.two,
    },
    retryBtn: {
      alignSelf: 'flex-start',
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.primarySurface,
    },
    retryText: {
      color: theme.primary,
      fontWeight: '700',
    },
    loadMoreBtn: {
      marginTop: Spacing.one,
      alignSelf: 'center',
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.round,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.backgroundElement,
    },
    loadMoreText: {
      color: theme.primary,
    },
  });
