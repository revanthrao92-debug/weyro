import { useState, useEffect } from 'react';
import { FlatList, Text, View, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useBookings } from '@/hooks/useBookings';
import { BookingCard } from '@/components/booking/BookingCard';
import { Chip, ScreenContainer, AppHeader, EmptyState, Skeleton } from '@/components/ui';
import { spacing, typography } from '@/theme';

export default function BookingsScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useBookings(statusFilter);

  const bookings = data?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader title="My Bookings" />
        {[0, 1, 2].map((i) => (
          <BookingCardSkeleton key={i} />
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title="My Bookings" />

      <View style={styles.filterRow}>
        {['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
          <Chip
            key={s}
            label={s.replace(/_/g, ' ')}
            selected={statusFilter === s}
            onPress={() => setStatusFilter(s)}
          />
        ))}
      </View>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings found" message="Your bookings will appear here." />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={(id) => {}} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refetch();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState title="No bookings found" message="Your bookings will appear here." />
          }
        />
      )}
    </ScreenContainer>
  );
}

function BookingCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton width="55%" height={18} />
      <Skeleton width="70%" height={14} style={{ marginTop: spacing.sm }} />
      <Skeleton width="60%" height={14} style={{ marginTop: spacing.xs }} />
      <Skeleton width="100%" height={12} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  skeletonCard: { marginBottom: spacing.md },
});
