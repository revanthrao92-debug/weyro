import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AdminOverviewMetrics,
  EscrowLedgerEntry,
  ProviderVerificationRecord,
} from '@weyro/api-contracts';
import {
  damageRequestStore,
  useOfflineSyncStatus,
} from '@/services/damage-request-store';

import { authStore } from '@/services/auth-store';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const getAdminHeaders = () => ({
  'Content-Type': 'application/json',
  ...(authStore.getUser()?.token
    ? { Authorization: `Bearer ${authStore.getUser().token}` }
    : {}),
});

const DEFAULT_METRICS: AdminOverviewMetrics = {
  totalRequests: 8,
  openBroadcasts: 5,
  totalQuotations: 12,
  acceptedQuotations: 3,
  totalBookings: 3,
  completedBookings: 1,
  totalEscrowVolume: 4350,
  pendingVerifications: 2,
  verifiedProviders: 1,
};

const DEFAULT_PROVIDERS: ProviderVerificationRecord[] = [
  {
    id: 'prov_01',
    businessName: 'Apex OEM Auto Dismantlers',
    providerType: 'PARTS_DEALER',
    phone: '+1 (555) 234-8901',
    address: 'Industrial Parkway Sector 4, Springfield',
    verificationStatus: 'VERIFIED',
    licenseNumber: 'LIC-OEM-89218',
    taxId: 'US-EIN-9921820',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    auditorNotes: 'Verified via state business registry and trade license check.',
  },
  {
    id: 'prov_02',
    businessName: 'Precision Euro-Tech Motors',
    providerType: 'GARAGE',
    phone: '+1 (555) 876-5432',
    address: '404 Oakridge Ave, Springfield',
    verificationStatus: 'PENDING',
    licenseNumber: 'LIC-GAR-44912',
    taxId: 'US-EIN-4412998',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    auditorNotes: 'Awaiting workshop safety certificate verification.',
  },
  {
    id: 'prov_03',
    businessName: 'RapidTire & Brakes Mobile Service',
    providerType: 'MECHANIC',
    phone: '+1 (555) 345-6789',
    address: '12 Metro Blvd, Springfield',
    verificationStatus: 'PENDING',
    licenseNumber: 'LIC-MEC-11029',
    taxId: 'US-EIN-1102934',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    auditorNotes: 'Technician ASE certification attached for review.',
  },
];

const DEFAULT_LEDGER: EscrowLedgerEntry[] = [
  {
    bookingId: 'bk_seed_01',
    customerName: 'Marcus Vance',
    providerName: 'Apex OEM Auto Dismantlers',
    amount: 1450,
    status: 'HELD_IN_ESCROW',
    confirmedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    bookingId: 'bk_seed_02',
    customerName: 'Elena Rostova',
    providerName: 'Precision Euro-Tech Motors',
    amount: 820,
    status: 'RELEASED_TO_PROVIDER',
    confirmedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export default function AdminOperationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const syncStatus = useOfflineSyncStatus();

  const [metrics, setMetrics] = useState<AdminOverviewMetrics>(DEFAULT_METRICS);
  const [providers, setProviders] = useState<ProviderVerificationRecord[]>(DEFAULT_PROVIDERS);
  const [ledger, setLedger] = useState<EscrowLedgerEntry[]>(DEFAULT_LEDGER);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isFlushingQueue, setIsFlushingQueue] = useState(false);

  const pendingMutations = damageRequestStore.getPendingMutations();

  async function loadAdminData() {
    setIsLoading(true);
    try {
      const [overviewRes, providersRes, ledgerRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/overview`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/providers`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/escrow-ledger`, { headers: getAdminHeaders() }),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setMetrics(data);
      }
      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data);
      }
      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger(data);
      }
    } catch {
      // Retain offline default state
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch(`${API_BASE_URL}/admin/overview`, { headers: getAdminHeaders() }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE_URL}/admin/providers`, { headers: getAdminHeaders() }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE_URL}/admin/escrow-ledger`, { headers: getAdminHeaders() }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([overview, provs, ledg]) => {
        if (!isMounted) return;
        if (overview) setMetrics(overview);
        if (provs) setProviders(provs);
        if (ledg) setLedger(ledg);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleVerify(id: string, newStatus: 'VERIFIED' | 'REJECTED') {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/providers/${id}/verify`, {
        method: 'PATCH',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          status: newStatus,
          auditorNotes: `Actioned by Ops Auditor on ${new Date().toLocaleDateString()}`,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProviders((prev) => prev.map((p) => (p.id === id ? updated : p)));
      } else {
        setProviders((prev) =>
          prev.map((p) => (p.id === id ? { ...p, verificationStatus: newStatus } : p))
        );
      }

      // Refresh overview
      loadAdminData();
      Alert.alert('Status Updated', `Provider has been marked as ${newStatus}.`);
    } catch {
      // Local optimistic update
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, verificationStatus: newStatus } : p))
      );
      Alert.alert('Offline Mode', `Provider locally marked as ${newStatus}.`);
    }
  }

  async function handleFlushQueue() {
    setIsFlushingQueue(true);
    try {
      const result = await damageRequestStore.flushQueue();
      await damageRequestStore.syncWithBackend();
      Alert.alert(
        'Offline Queue Flushed',
        `Synced: ${result.synced} mutations, Pending/Failed: ${result.failed}`
      );
    } finally {
      setIsFlushingQueue(false);
    }
  }

  const filteredProviders = providers.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.verificationStatus === filterStatus;
  });

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.title}>Operations {'&'} Dispatch</ThemedText>
            <ThemedText style={styles.subtitle}>
              Platform compliance, escrow monitoring, and offline queue health
            </ThemedText>
          </View>
          <Pressable
            style={[styles.refreshButton, { backgroundColor: theme.backgroundElement }]}
            onPress={loadAdminData}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <ThemedText style={styles.refreshButtonText}>↻ Refresh</ThemedText>
            )}
          </Pressable>
        </View>

        {/* Offline Sync & Mutation Durability Card */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <View>
              <ThemedText style={styles.cardTitle}>Offline Mutation Queue</ThemedText>
              <ThemedText style={styles.cardSubtitle}>
                {syncStatus.isOnline ? '🟢 Connected to Weyro Cloud API' : '🟠 Running in Offline Resilient Mode'}
              </ThemedText>
            </View>
            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: pendingMutations.length > 0 ? '#FEF3C7' : '#DCFCE7' },
                ]}>
                <ThemedText
                  style={[
                    styles.statusBadgeText,
                    { color: pendingMutations.length > 0 ? '#B45309' : '#15803D' },
                  ]}>
                  {pendingMutations.length} Pending
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.syncDetails}>
            <ThemedText style={styles.metaLabel}>Last Synced:</ThemedText>
            <ThemedText style={styles.metaValue}>
              {syncStatus.lastSyncedAt
                ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
                : 'Just now'}
            </ThemedText>
          </View>

          {pendingMutations.length > 0 && (
            <View style={styles.pendingList}>
              {pendingMutations.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.pendingItem}>
                  <ThemedText style={styles.pendingType}>
                    {item.type} • {item.method}
                  </ThemedText>
                  <ThemedText style={styles.pendingUrl} numberOfLines={1}>
                    {item.url}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={[styles.flushButton, { opacity: isFlushingQueue ? 0.7 : 1 }]}
            onPress={handleFlushQueue}
            disabled={isFlushingQueue}>
            {isFlushingQueue ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.flushButtonText}>
                ⚡ Flush {'&'} Re-sync Mutations ({pendingMutations.length})
              </ThemedText>
            )}
          </Pressable>
        </View>

        {/* KPI Overview Metrics */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.metricNumber}>{metrics?.openBroadcasts ?? 0}</ThemedText>
            <ThemedText style={styles.metricLabel}>Open Broadcasts</ThemedText>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.metricNumber}>{metrics?.totalQuotations ?? 0}</ThemedText>
            <ThemedText style={styles.metricLabel}>Bids Received</ThemedText>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.metricNumber, { color: '#059669' }]}>
              ${(metrics?.totalEscrowVolume ?? 0).toLocaleString()}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Escrow Volume</ThemedText>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.metricNumber, { color: '#2563EB' }]}>
              {metrics?.pendingVerifications ?? 0}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Pending KYC</ThemedText>
          </View>
        </View>

        {/* Provider Verification Section */}
        <View style={styles.sectionHeader}>
          <View>
            <ThemedText style={styles.sectionTitle}>Provider Verification Queue</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              Audit mechanic and spare-parts dealer licenses
            </ThemedText>
          </View>
          <View style={styles.filterPills}>
            {(['ALL', 'PENDING', 'VERIFIED'] as const).map((filter) => (
              <Pressable
                key={filter}
                style={[
                  styles.filterPill,
                  filterStatus === filter && styles.filterPillActive,
                ]}
                onPress={() => setFilterStatus(filter)}>
                <ThemedText
                  style={[
                    styles.filterPillText,
                    filterStatus === filter && styles.filterPillTextActive,
                  ]}>
                  {filter}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {filteredProviders.map((provider) => (
          <View
            key={provider.id}
            style={[styles.providerCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.providerCardTop}>
              <View>
                <ThemedText style={styles.providerName}>{provider.businessName}</ThemedText>
                <ThemedText style={styles.providerCategory}>
                  {provider.providerType} • {provider.phone}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.verificationBadge,
                  {
                    backgroundColor:
                      provider.verificationStatus === 'VERIFIED'
                        ? '#DCFCE7'
                        : provider.verificationStatus === 'REJECTED'
                        ? '#FEE2E2'
                        : '#FEF3C7',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.verificationBadgeText,
                    {
                      color:
                        provider.verificationStatus === 'VERIFIED'
                          ? '#15803D'
                          : provider.verificationStatus === 'REJECTED'
                          ? '#B91C1C'
                          : '#B45309',
                    },
                  ]}>
                  {provider.verificationStatus}
                </ThemedText>
              </View>
            </View>

            <View style={styles.licenseRow}>
              <ThemedText style={styles.licenseText}>
                📋 License: {provider.licenseNumber || 'Not submitted'}
              </ThemedText>
              <ThemedText style={styles.licenseText}>
                🏛️ Tax ID: {provider.taxId || 'Not submitted'}
              </ThemedText>
            </View>
            <ThemedText style={styles.addressText}>📍 {provider.address}</ThemedText>
            {provider.auditorNotes && (
              <ThemedText style={styles.notesText}>
                📝 Notes: {provider.auditorNotes}
              </ThemedText>
            )}

            {provider.verificationStatus === 'PENDING' && (
              <View style={styles.actionButtonsRow}>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleVerify(provider.id, 'VERIFIED')}>
                  <ThemedText style={styles.actionBtnText}>✓ Approve {'&'} Verify</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleVerify(provider.id, 'REJECTED')}>
                  <ThemedText style={styles.rejectBtnText}>✕ Reject</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        {/* Escrow Reconciliation Ledger */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Escrow Reconciliation Ledger</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Trace of held and disbursed booking funds
          </ThemedText>
        </View>

        {ledger.map((entry) => (
          <View
            key={entry.bookingId}
            style={[styles.ledgerCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.ledgerTop}>
              <View>
                <ThemedText style={styles.ledgerCustomer}>{entry.customerName}</ThemedText>
                <ThemedText style={styles.ledgerProvider}>Fulfillment by {entry.providerName}</ThemedText>
              </View>
              <ThemedText style={styles.ledgerAmount}>${(entry.amount ?? 0).toLocaleString()}</ThemedText>
            </View>
            <View style={styles.ledgerBottom}>
              <View
                style={[
                  styles.escrowStatusBadge,
                  {
                    backgroundColor:
                      entry.status === 'RELEASED_TO_PROVIDER'
                        ? '#DCFCE7'
                        : entry.status === 'REFUNDED_TO_CUSTOMER'
                        ? '#FEE2E2'
                        : '#E0E7FF',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.escrowStatusText,
                    {
                      color:
                        entry.status === 'RELEASED_TO_PROVIDER'
                          ? '#15803D'
                          : entry.status === 'REFUNDED_TO_CUSTOMER'
                          ? '#B91C1C'
                          : '#3730A3',
                    },
                  ]}>
                  {entry.status.replace(/_/g, ' ')}
                </ThemedText>
              </View>
              <ThemedText style={styles.ledgerDate}>
                {new Date(entry.confirmedAt).toLocaleDateString()}
              </ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  refreshButton: {
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 4,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  syncDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
    paddingBottom: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  metaLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingList: {
    marginBottom: Spacing.two,
  },
  pendingItem: {
    paddingVertical: 4,
  },
  pendingType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  pendingUrl: {
    fontSize: 11,
    opacity: 0.6,
  },
  flushButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  flushButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.15)',
  },
  filterPillActive: {
    backgroundColor: '#000000',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    opacity: 1,
  },
  providerCard: {
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  providerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  providerCategory: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  verificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verificationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  licenseText: {
    fontSize: 12,
    opacity: 0.8,
  },
  addressText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.6,
    marginTop: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  rejectBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  ledgerCard: {
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  ledgerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  ledgerCustomer: {
    fontSize: 15,
    fontWeight: '700',
  },
  ledgerProvider: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  ledgerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  escrowStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  escrowStatusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ledgerDate: {
    fontSize: 11,
    opacity: 0.5,
  },
});
