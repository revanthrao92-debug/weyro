import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useBroadcastFeed, useCreateQuotation } from '@/hooks/useRequests';
import {
  ScreenContainer,
  AppHeader,
  Card,
  Chip,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
  FadeSlideIn,
  FilterBar,
} from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { titleize as labelize } from '@/utils/format';

const CATEGORIES = ['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'];


export default function BroadcastFeedScreen() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const router = useRouter();
  const { data, isLoading } = useBroadcastFeed({ category: categoryFilter });
  const createQuotation = useCreateQuotation();

  const requests = data?.items ?? [];
  const showFilters = requests.length > 0 || !!categoryFilter;

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark">
        <AppHeader title="Opportunities" subtitle="Nearby service requests" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  const handleQuote = async (requestId: string) => {
    try {
      await createQuotation.mutateAsync({
        requestId,
        data: {
          partsCost: 0,
          labourCost: 0,
          warrantyDays: 30,
          etaDescription: 'Same day',
        },
      });
      Alert.alert('Success', 'Quotation sent');
      router.push(`/requests/${requestId}`);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to send quotation');
    }
  };

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Opportunities" subtitle="Nearby service requests" />

      {showFilters ? (
        <FilterBar>
          <View style={styles.filterRow}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={labelize(c)}
            selected={categoryFilter === c}
            onPress={() => setCategoryFilter((prev) => (prev === c ? undefined : c))}
          />
        ))}
          </View>
        </FilterBar>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState
          title={categoryFilter ? 'No requests match this filter' : 'No requests found'}
          message={categoryFilter ? 'Try a different category.' : 'Nearby requests will appear here.'}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <FadeSlideIn delay={Math.min(index, 6) * 50}>
              <FeedRequestCard item={item} onQuote={handleQuote} />
            </FadeSlideIn>
          )}
        />
      )}
    </ScreenContainer>
  );
}

function FeedRequestCard({ item, onQuote }: { item: any; onQuote: (id: string) => void }) {
  return (
    <Card style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.requestTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.requestCategory}>{labelize(item.category)}</Text>
        <Text style={styles.requestAddress} numberOfLines={1}>
          {item.address}
        </Text>
        <View style={styles.urgencyRow}>
          <StatusPill
            label={item.urgency}
            tone={item.urgency === 'EMERGENCY' ? 'danger' : 'neutral'}
          />
        </View>
      </View>
      <Button title="Quote" onPress={() => onQuote(item.id)} style={styles.quoteBtn} />
    </Card>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: { paddingBottom: spacing.xl },
  skeletonCard: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  info: { flex: 1 },
  requestTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  requestCategory: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  requestAddress: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  urgencyRow: { flexDirection: 'row', marginTop: spacing.sm },
  quoteBtn: { minWidth: 88 },
});
