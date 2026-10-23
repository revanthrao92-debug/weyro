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
  const { data, isLoading } = useMyRequests();

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

  return (
    <ScreenContainer>
      <AppHeader title="My Requests" subtitle="Your service requests" />

      <View style={styles.filterRow}>
        {FILTERS.map((s) => (
          <Chip
            key={s}
            label={labelize(s)}
            selected={statusFilter === s}
            onPress={() => setStatusFilter(s)}
          />
        ))}
      </View>

      {requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          message="Create a request to get quotes from nearby mechanics."
          action={<Button title="Create Request" onPress={() => router.push('/requests/create')} />}
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
    marginBottom: spacing.lg,
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
