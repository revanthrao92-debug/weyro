import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBroadcastFeed, useMyQuotations } from '@/hooks/useRequests';
import {
  ScreenContainer,
  AppHeader,
  Card,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
  FadeSlideIn,
} from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { titleize as labelize, formatDate } from '@/utils/format';

export default function ProviderRequestsScreen() {
  const router = useRouter();
  const { providerProfile } = useAuth();
  const isMechanic = ['MECHANIC', 'GARAGE', 'AUTHORIZED_CENTER'].includes(
    providerProfile?.providerType ?? '',
  );
  const subtitle = isMechanic
    ? 'Repair and maintenance work nearby'
    : 'Spare-part requests nearby';
  const { data, isLoading, refetch } = useBroadcastFeed();
  const { data: myQuotes } = useMyQuotations({ limit: 50 });

  const requests = data?.items ?? [];

  const quoteByRequest = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const quote of myQuotes?.items ?? []) {
      map.set(quote.requestId, { id: quote.id, status: quote.status });
    }
    return map;
  }, [myQuotes]);

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader title="Requests" subtitle={subtitle} />
        <View style={styles.body}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.skeletonCard}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="90%" height={12} style={{ marginTop: spacing.sm }} />
              <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
            </Card>
          ))}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader title="Requests" subtitle={subtitle} />
      {requests.length === 0 ? (
        <EmptyState
          title="No open requests"
          message={
            isMechanic
              ? 'New repair requests in your service radius will appear here.'
              : 'New spare-part requests in your service radius will appear here.'
          }
          action={
            <Button title="Refresh" variant="secondary" onPress={() => void refetch()} />
          }
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <FadeSlideIn delay={Math.min(index, 6) * 50}>
              <RequestCard
                item={item}
                myQuote={quoteByRequest.get(item.id)}
                onPress={() => router.push(`/requests/${item.id}`)}
              />
            </FadeSlideIn>
          )}
        />
      )}
    </ScreenContainer>
  );
}

function RequestCard({
  item,
  myQuote,
  onPress,
}: {
  item: any;
  myQuote?: { id: string; status: string };
  onPress: () => void;
}) {
  const vehicle = item.vehicle
    ? `${item.vehicle.make} ${item.vehicle.model} ${item.vehicle.year ?? ''}`.trim()
    : null;
  const detail = String(item.description ?? '')
    .split('\n')
    .slice(0, 2)
    .join(' · ');

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.info}>
          <Text style={styles.requestTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.requestMeta} numberOfLines={1}>
            {vehicle ? `${vehicle} · ` : ''}
            {item.address}
          </Text>
        </View>
        <StatusPill
          label={labelize(item.urgency)}
          tone={
            item.urgency === 'EMERGENCY'
              ? 'danger'
              : item.urgency === 'URGENT'
                ? 'warning'
                : 'neutral'
          }
        />
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {detail}
      </Text>

      <View style={styles.footer}>
        <View style={styles.footerMeta}>
          <Text style={styles.metaText}>
            {labelize(item.category)}
            {item.fulfillmentType
              ? ` · ${labelize(item.fulfillmentType)}`
              : ''}
          </Text>
          <Text style={styles.metaText}>
            {item.quotationsCount ?? 0} quote
            {(item.quotationsCount ?? 0) === 1 ? '' : 's'} · closes{' '}
            {formatDate(item.expiresAt)}
          </Text>
        </View>
        {myQuote ? (
          <View style={styles.quotedRow}>
            <StatusPill label={labelize(myQuote.status)} tone="info" />
            <Button title="View quote" variant="secondary" onPress={onPress} />
          </View>
        ) : (
          <Button title="Respond" onPress={onPress} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  info: { flex: 1 },
  requestTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  requestMeta: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  description: { ...typography.caption, color: palette.textSecondary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  footerMeta: { flex: 1, gap: 2 },
  metaText: { ...typography.label, color: palette.textMuted },
  quotedRow: { alignItems: 'flex-end', gap: spacing.xs },
});
