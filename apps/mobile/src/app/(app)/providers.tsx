import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, ToastAndroid, Platform, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { useAdminProviders, useVerifyProvider } from '@/hooks/useAdmin';
import type { ProviderVerificationRecord } from '@/hooks/useAdmin';
import {
  ScreenContainer,
  AppHeader,
  StatusPill,
  EmptyState,
  Skeleton,
  FilterChips,
  Button,
} from '@/components/ui';
import { labelize, formatDate } from '@/utils/format';
import { palette, spacing, radii, typography } from '@/theme';

/**
 * Admin — provider verification (Checkpoint 3).
 * One primary action per card: PENDING rows show a single Verify button;
 * VERIFIED/REJECTED/SUSPENDED rows are status-only. No duplicated CTAs.
 */

const FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Rejected', value: 'REJECTED' },
];

function StatusPillTone(status: string) {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function notify(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('Weyro', msg);
}

export default function ProvidersScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading } = useAdminProviders(
    statusFilter === 'ALL' ? undefined : statusFilter,
  );
  const verifyProvider = useVerifyProvider();

  const providers = data?.items ?? [];
  const pendingCount = providers.filter((p) => p.verificationStatus === 'PENDING').length;

  const handleVerify = async (record: ProviderVerificationRecord) => {
    try {
      await verifyProvider.mutateAsync({ id: record.id, status: 'VERIFIED' });
      notify(`${record.businessName} verified`);
    } catch (e: any) {
      notify(e?.message || 'Verification failed');
    }
  };

  const header = (
    <View style={styles.pendingRow}>
      <Text style={styles.pendingLabel}>Pending verification</Text>
      <Text style={styles.pendingValue}>{pendingCount}</Text>
    </View>
  );

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Provider Verification" subtitle="Manage provider onboarding" />

      <FilterChips
        options={FILTERS}
        value={statusFilter ?? 'ALL'}
        onChange={(value) => setStatusFilter(value === 'ALL' ? undefined : value)}
      />

      {isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={88} />)
      ) : providers.length === 0 ? (
        <EmptyState
          icon={<UserRound size={28} color={palette.textMuted} />}
          title="No providers here"
          message="Providers with this verification state will appear here."
        />
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ProviderCard item={item} onVerify={handleVerify} />}
        />
      )}
    </ScreenContainer>
  );
}

function ProviderCard({
  item,
  onVerify,
  submitting,
}: {
  item: ProviderVerificationRecord;
  onVerify: (r: ProviderVerificationRecord) => Promise<void>;
  submitting?: boolean;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.head}>
        <View style={cardStyles.avatar}>
          <UserRound size={20} color={palette.onAccent} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.name} numberOfLines={1} maxFontSizeMultiplier={2}>
            {item.businessName}
          </Text>
          <Text style={cardStyles.meta} numberOfLines={1}>
            {labelize(item.providerType)} · {item.phone}
          </Text>
        </View>
        <StatusPill label={item.verificationStatus} tone={StatusPillTone(item.verificationStatus)} />
      </View>

      <View style={cardStyles.footer}>
        <Text style={cardStyles.registered}>Onboarded {formatDate(item.createdAt)}</Text>
        {item.verificationStatus === 'PENDING' ? (
          // The ONE action on a pending card
          <Button
            title="Verify"
            loading={submitting}
            onPress={() => void onVerify(item)}
            style={cardStyles.verifyBtn}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingLabel: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  pendingValue: {
    ...typography.heading,
    color: palette.textPrimary,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  registered: {
    ...typography.label,
    color: palette.textMuted,
    flex: 1,
  },
  verifyBtn: { minWidth: 108 },
});
