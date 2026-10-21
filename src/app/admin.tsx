import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AdminOverviewMetrics,
  EscrowLedgerEntry,
  ProviderVerificationRecord,
} from '@weyro/api-contracts';
import { apiClient } from '@/services/api-client';
import { offlineQueue, useOfflineQueue } from '@/services/offline-queue';
import { AdminOverviewCards } from '@/components/admin/AdminOverviewCards';
import { AdminProviderItem } from '@/components/admin/AdminProviderItem';
import { AdminEscrowLedger } from '@/components/admin/AdminEscrowLedger';
import { AdminOfflineBanner } from '@/components/admin/AdminOfflineBanner';

const INITIAL_METRICS: AdminOverviewMetrics = {
  totalRequests: 0,
  openBroadcasts: 0,
  totalQuotations: 0,
  acceptedQuotations: 0,
  totalBookings: 0,
  completedBookings: 0,
  totalEscrowVolume: 0,
  pendingVerifications: 0,
  verifiedProviders: 0,
};

export default function AdminScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const offlineStatus = useOfflineQueue();

  const [metrics, setMetrics] = useState<AdminOverviewMetrics>(INITIAL_METRICS);
  const [providers, setProviders] = useState<ProviderVerificationRecord[]>([]);
  const [ledger, setLedger] = useState<EscrowLedgerEntry[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get<any>('/admin/overview').catch(() => null),
      apiClient.get<any>('/admin/providers').catch(() => null),
    ]).then(([overviewData, providersData]) => {
      if (!active) return;
      if (overviewData) {
        setMetrics({
          totalRequests: overviewData.totalRequests || 0,
          openBroadcasts: overviewData.openBroadcasts || 0,
          totalQuotations: overviewData.totalQuotations || 0,
          acceptedQuotations: overviewData.acceptedQuotations || 0,
          totalBookings: overviewData.totalBookings || 0,
          completedBookings: overviewData.completedBookings || 0,
          totalEscrowVolume: overviewData.totalEscrowVolume || 0,
          pendingVerifications: overviewData.pendingVerifications || 0,
          verifiedProviders: overviewData.verifiedProviders || 0,
        });
        if (overviewData.recentEscrowLedger) {
          setLedger(overviewData.recentEscrowLedger);
        }
      }

      if (providersData?.items && Array.isArray(providersData.items)) {
        setProviders(providersData.items);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleUpdateProviderStatus = async (
    providerId: string,
    status: 'VERIFIED' | 'REJECTED',
  ) => {
    try {
      await apiClient.patch(`/admin/providers/${providerId}/verification`, {
        status,
        auditorNotes: `Audited and marked ${status} via Mobile Admin Console.`,
      });

      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, verificationStatus: status } : p,
        ),
      );
      Alert.alert('Status Updated', `Partner marked as ${status}.`);
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update partner verification.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: safeAreaInsets.top + Spacing.three,
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.contentWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: theme.dangerSurface }]}>
              <ThemedText style={[styles.badgeText, { color: theme.danger }]}>
                WEYRO CENTRAL OPS & COMPLIANCE
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.title}>
              Marketplace Operations
            </ThemedText>
            <ThemedText style={styles.subtitle} themeColor="textSecondary">
              National audit console: verify workshops, monitor UPI escrow milestones, and sync offline mutations.
            </ThemedText>
          </View>

          <AdminOfflineBanner
            status={offlineStatus}
            onFlush={() => offlineQueue.flush()}
          />

          <AdminOverviewCards metrics={metrics} />

          {/* Partner Verifications */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              PROVIDER VERIFICATIONS ({providers.length})
            </ThemedText>
            {providers.length === 0 ? (
              <ThemedText style={styles.emptyText} themeColor="textSecondary">
                No provider onboarding applications pending audit.
              </ThemedText>
            ) : (
              providers.map((p) => (
                <AdminProviderItem
                  key={p.id}
                  provider={p}
                  onVerify={() => handleUpdateProviderStatus(p.id, 'VERIFIED')}
                  onReject={() => handleUpdateProviderStatus(p.id, 'REJECTED')}
                />
              ))
            )}
          </View>

          <AdminEscrowLedger entries={ledger} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
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
  },
  section: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    letterSpacing: 1.1,
    marginBottom: Spacing.two,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
