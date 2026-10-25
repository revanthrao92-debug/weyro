import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyRequests } from '@/hooks/useRequests';
import {
  ScreenContainer,
  AppHeader,
  Card,
  Chip,
  StatusPill,
  EmptyState,
  Skeleton,
  Button,
  FilterBar,
} from '@/components/ui';
import { StatusTone, palette, spacing, typography } from '@/theme';

const FILTERS = ['OPEN', 'QUOTES_RECEIVED', 'ACCEPTED', 'CANCELLED', 'COMPLETED'];

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace('_', ' ');
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN':
    case 'QUOTES_RECEIVED':
      return 'info';
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function MyRequestsScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const router = useRouter();
  const { data, isLoading } = useMyRequests(
    statusFilter ? { status: statusFilter } : undefined
  );

  const requests = data?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader title="My Requests" subtitle="Your service requests" />
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.skeletonCard}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
            <Skeleton width="70%" height={12} style={{ marginTop: spacing.xs }} />
          </Card>
        ))}
      </ScreenContainer>
    );
  }

  // Filters only make sense when there is something to filter — hide the row
  // on a genuinely empty account (keep it when a filter hides the results).
  const showFilters = requests.length > 0 || !!statusFilter;

  return (
    <ScreenContainer>
      <AppHeader title="My Requests" subtitle="Your service requests" />

      {showFilters ? (
        <FilterBar>
          <View style={styles.filterRow}>
          {FILTERS.map((s) => (
            <Chip
              key={s}
              label={labelize(s)}
              selected={statusFilter === s}
              onPress={() =>
                setStatusFilter((prev) => (prev === s ? undefined : s))
              }
            />
          ))}
          </View>
        </FilterBar>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState
          title={statusFilter ? 'No requests match this filter' : 'No requests yet'}
          message={
            statusFilter
              ? `You have no ${labelize(statusFilter).toLowerCase()} requests.`
              : 'Create a request to get quotes from nearby mechanics.'
          }
          action={
            statusFilter ? undefined : (
              <Button title="Create Request" onPress={() => router.push('/requests/create')} />
            )
          }
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RequestCard item={item} onPress={() => router.push(`/requests/${item.id}`)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function RequestCard({ item, onPress }: { item: any; onPress: () => void }) {
  const tone = statusTone(item.status);
  return (
    <TouchableOpacity
      style={styles.cardTouch}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Request ${item.title}`}
    >
      <Card>
        <View style={styles.cardTop}>
          <Text style={styles.requestTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <StatusPill label={labelize(item.status)} tone={tone} />
        </View>
        <Text style={styles.requestCategory}>{labelize(item.category)}</Text>
        <Text style={styles.requestAddress} numberOfLines={1}>
          {item.address}
        </Text>
      </Card>
    </TouchableOpacity>
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
  cardTouch: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  requestTitle: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  requestCategory: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.xs },
  requestAddress: { ...typography.caption, color: palette.textSecondary },
});
