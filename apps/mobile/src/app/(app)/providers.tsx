import { useState } from 'react';
import {
  FlatList,
  Linking,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { FileCheck2, UserRound } from 'lucide-react-native';
import {
  useAdminProviderDetail,
  useAdminProviders,
  useVerifyProvider,
  type ProviderVerificationRecord,
} from '@/hooks/useAdmin';
import {
  Button,
  Chip,
  EmptyState,
  Input,
  PressableScale,
  ScreenContainer,
  Skeleton,
  StatusPill,
  ErrorState,
  PageHeader,
} from '@/components/ui';
import { confirmAction, notice } from '@/lib/confirm';
import { formatDate, labelize } from '@/utils/format';
import { palette, spacing, typography, type StatusTone } from '@/theme';
import { useRefreshControl } from '@/hooks/useRefreshControl';

const FILTERS = ['ALL', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  ALL: 'All',
  PENDING: 'Waiting for review',
  VERIFIED: 'Verified',
  REJECTED: 'Not approved',
  SUSPENDED: 'Suspended',
};

type Decision = 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
/** What each decision means for the business, asked before it happens. */
const DECISION: Record<Decision, { button: string; ask: (name: string) => string; done: (name: string) => string }> = {
  VERIFIED: {
    button: 'Approve',
    ask: (n) => `${n} can take work on Weyro straight away.`,
    done: (n) => `${n} is approved.`,
  },
  REJECTED: {
    button: 'Not approved',
    ask: (n) => `${n} will see that their documents were not approved and can send new ones.`,
    done: (n) => `${n} was marked not approved.`,
  },
  SUSPENDED: {
    button: 'Suspend',
    ask: (n) => `${n} can't take new work until you approve them again.`,
    done: (n) => `${n} is suspended.`,
  },
};
/** Only the decisions that make sense from the current status. */
const NEXT: Record<string, Decision[]> = {
  PENDING: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED'],
  REJECTED: ['VERIFIED'],
  SUSPENDED: ['VERIFIED'],
};

function docLabel(label: string) {
  const upper = label.replace(/\b(gst|pan)\b/gi, (match) => match.toUpperCase());
  const spaced = upper.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusTone(status: string): StatusTone {
  if (status === 'VERIFIED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger';
  return 'neutral';
}

export default function ProvidersScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('PENDING');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useAdminProviders(
    filter === 'ALL' ? undefined : filter,
  );
  const refreshControl = useRefreshControl(refetch);
  const providers = data?.items ?? [];

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        refreshControl={refreshControl}
        data={isLoading ? [] : providers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <PageHeader title="Providers" subtitle="Check documents and approve businesses" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((item) => (
                <Chip
                  key={item}
                  label={FILTER_LABEL[item]}
                  selected={filter === item}
                  onPress={() => {
                    setFilter(item);
                    setExpanded(null);
                  }}
                />
              ))}
            </ScrollView>
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeleton}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : isError ? (
            <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              icon={<UserRound size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={filter === 'ALL' ? 'No providers yet' : 'Nothing here'}
              message={
                filter === 'ALL'
                  ? 'Provider accounts appear here after registration.'
                  : 'No providers match this verification state.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ProviderRow
            item={item}
            expanded={expanded === item.id}
            onToggle={() =>
              setExpanded((current) => (current === item.id ? null : item.id))
            }
          />
        )}
      />
    </ScreenContainer>
  );
}

function ProviderRow({
  item,
  expanded,
  onToggle,
}: {
  item: ProviderVerificationRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detail = useAdminProviderDetail(expanded ? item.id : undefined);
  const verify = useVerifyProvider();
  const [notes, setNotes] = useState('');

  const update = async (status: Decision) => {
    const d = DECISION[status];
    if (!(await confirmAction(`${d.button}: ${item.businessName}?`, d.ask(item.businessName), d.button))) return;
    try {
      await verify.mutateAsync({
        id: item.id,
        status,
        ...(notes.trim() ? { auditorNotes: notes.trim() } : {}),
      });
      setNotes('');
      notice('Done', d.done(item.businessName));
    } catch (e: any) {
      notice('Could not update this provider', e?.message || 'Check your connection and try again.');
    }
  };

  const documents = detail.data?.verificationDocuments ?? null;

  return (
    <View style={styles.rowWrap}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${item.businessName}, ${item.verificationStatus}`}
        scaleTo={0.99}
        style={styles.row}
      >
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>
            {item.businessName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {labelize(item.providerType)}, {item.phone}
          </Text>
          <Text style={styles.registered}>
            Onboarded {formatDate(item.createdAt)}
          </Text>
        </View>
        <StatusPill
          label={labelize(item.verificationStatus)}
          tone={statusTone(item.verificationStatus)}
        />
      </PressableScale>

      {expanded ? (
        <View style={styles.detail}>
          {detail.isLoading ? (
            <Skeleton width="100%" height={80} />
          ) : detail.data ? (
            <>
              <View style={styles.detailGrid}>
                <Detail label="Email" value={detail.data.email} />
                <Detail label="Address" value={detail.data.address} />
                <Detail
                  label="Jobs"
                  value={`${detail.data.counts.bookings} jobs, ${detail.data.counts.quotations} quotes`}
                />
                <Detail
                  label="Reviews"
                  value={`${detail.data.counts.reviews} reviews${
                    detail.data.counts.listings
                      ? `, ${detail.data.counts.listings} listings`
                      : ''
                  }`}
                />
              </View>

              <Text style={styles.sectionLabel}>Documents</Text>
              {documents && Object.keys(documents).length > 0 ? (
                Object.entries(documents).map(([label, url]) => (
                  <PressableScale
                    key={label}
                    onPress={() => void Linking.openURL(url)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${label}`}
                    scaleTo={0.98}
                    style={styles.docRow}
                  >
                    <FileCheck2 size={15} color={palette.textSecondary} strokeWidth={1.8} />
                    <Text style={styles.docLabel}>{docLabel(label)}</Text>
                    <Text style={styles.docOpen}>View</Text>
                  </PressableScale>
                ))
              ) : (
                <Text style={styles.meta}>No documents uploaded.</Text>
              )}

              <Input
                label="Note for the record (optional)"
                placeholder="Why, or which documents are missing"
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.actions}>
                {(NEXT[item.verificationStatus] ?? []).map((status) => (
                  <Button
                    key={status}
                    title={DECISION[status].button}
                    variant={status === 'VERIFIED' ? 'primary' : status === 'REJECTED' ? 'destructive' : 'secondary'}
                    loading={verify.isPending && verify.variables?.status === status}
                    disabled={verify.isPending}
                    onPress={() => void update(status)}
                    style={styles.action}
                  />
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.meta}>Could not load provider details.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  skeleton: { paddingVertical: spacing.md },
  rowWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textSecondary },
  registered: { ...typography.caption, color: palette.textMuted },
  detail: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  detailGrid: { gap: 2 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 3,
  },
  detailLabel: { ...typography.caption, color: palette.textMuted },
  detailValue: {
    ...typography.caption,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  sectionLabel: { ...typography.captionMedium, color: palette.textSecondary, marginTop: spacing.sm },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  docLabel: { ...typography.caption, color: palette.textPrimary, flex: 1 },
  docOpen: { ...typography.captionMedium, color: palette.accent },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
