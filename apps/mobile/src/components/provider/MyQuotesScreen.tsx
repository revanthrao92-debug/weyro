import { useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyQuotations,
  useUpdateQuotation,
  useWithdrawQuotation,
} from '@/hooks/useRequests';
import {
  ScreenContainer,
  PageHeader,
  Card,
  Chip,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { quoteTimeText } from '@/utils/quotes';
import { QuoteComposer } from '@/components/dealer/QuoteComposer';
import { palette, spacing, typography } from '@/theme';
import { formatDate, titleize as labelize, quotationStatusTone as statusTone, formatRupees } from '@/utils/format';

const FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'];

export function MyQuotesScreen({ pushed = false }: { pushed?: boolean } = {}) {
  const router = useRouter();
  const { providerProfile } = useAuth();
  const providerType = providerProfile?.providerType ?? '';
  const quoteMode =
    providerType === 'TOWING'
      ? 'towing'
      : providerType === 'ROADSIDE'
        ? 'roadside'
        : ['MECHANIC', 'GARAGE', 'AUTHORIZED_CENTER'].includes(providerType)
          ? 'service'
          : 'parts';
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data, isLoading, refetch } = useMyQuotations({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });
  const withdrawQuotation = useWithdrawQuotation();
  const updateQuotation = useUpdateQuotation();

  const quotes = data?.items ?? [];
  const showFilters = quotes.length > 0 || statusFilter !== 'ALL';

  const handleWithdraw = async (id: string) => {
    try {
      await withdrawQuotation.mutateAsync(id);
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to withdraw quotation');
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <PageHeader back={pushed} title="My quotes" subtitle="Quotes you have sent" />
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.skeletonCard}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="30%" height={22} style={{ marginTop: spacing.sm }} />
              <Skeleton width="50%" height={12} style={{ marginTop: spacing.sm }} />
            </Card>
          ))}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <PageHeader
        back={pushed}
        title="My quotes"
        subtitle={quotes.length > 0 && statusFilter === 'ALL' ? `${quotes.length} sent` : 'Quotes you have sent'}
      />

      {showFilters ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((s) => (
            <Chip
              key={s}
              label={labelize(s)}
              selected={statusFilter === s}
              onPress={() => {
                setStatusFilter(s);
                setEditingId(null);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      {quotes.length === 0 ? (
        <EmptyState
          title={statusFilter === 'ALL' ? 'No quotes yet' : 'No quotes match this filter'}
          message={
            statusFilter === 'ALL'
              ? 'Quotations you send will appear here.'
              : 'Try a different status.'
          }
          action={
            statusFilter === 'ALL' ? (
              <Button title="Browse requests" onPress={() => router.push('/opportunities')} />
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const request = item.request;
            const isEditing = editingId === item.id;
            return (
              <Card style={styles.card}>
                <View style={styles.info}>
                  <Text style={styles.quoteTitle} numberOfLines={1}>
                    {request?.title ?? 'Service request'}
                  </Text>
                  <Text style={styles.quoteMeta} numberOfLines={1}>
                    {[request?.vehicle ? `${request.vehicle.make} ${request.vehicle.model}` : null, `sent ${formatDate(item.createdAt)}`]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.quoteAmount}>
                      {formatRupees(item.totalCost)}
                    </Text>
                    <StatusPill label={labelize(item.status)} tone={statusTone(item.status)} />
                  </View>
                  {quoteTimeText(item) ? <Text style={styles.quoteETA}>{quoteTimeText(item)}</Text> : null}
                </View>

                {isEditing ? (
                  <View style={styles.editor}>
                    <QuoteComposer
                      mode={quoteMode}
                      estimate={
                        quoteMode === 'towing'
                          ? Number(item.totalCost)
                          : undefined
                      }
                      initial={item}
                      submitLabel="Save changes"
                      submitting={updateQuotation.isPending}
                      onSubmit={async (data) => {
                        try {
                          await updateQuotation.mutateAsync({ id: item.id, data });
                          setEditingId(null);
                          await refetch();
                        } catch (e: any) {
                          Alert.alert('Failed', e.message || 'Unable to update quote');
                        }
                      }}
                    />
                    <Button
                      title="Cancel edit"
                      variant="secondary"
                      onPress={() => setEditingId(null)}
                    />
                  </View>
                ) : (
                  <View style={styles.actions}>
                      {request ? (
                        <Button
                          title="Open request"
                          variant="secondary"
                          onPress={() => router.push(`/requests/${request.id}`)}
                        />
                      ) : null}
                      {item.status === 'PENDING' ? (
                        <>
                          <Button title="Edit" onPress={() => setEditingId(item.id)} />
                          <Button
                            title="Withdraw"
                            variant="destructive"
                            onPress={() => void handleWithdraw(item.id)}
                          />
                        </>
                      ) : null}
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterScroll: { flexGrow: 0, marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  info: { flex: 1 },
  quoteTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  quoteMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  quoteAmount: { ...typography.title, color: palette.textPrimary },
  quoteETA: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  editor: { gap: spacing.md },
});
