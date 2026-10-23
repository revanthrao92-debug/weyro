import { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useBookings } from '@/hooks/useBookings';
import { BookingCard } from '@/components/booking/BookingCard';

export default function BookingsScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useBookings(statusFilter);

  const bookings = data?.items ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <View style={styles.filterRow}>
          {['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>
                {s.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text>No bookings found</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={(id) => {}} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => {
              setRefreshing(true);
              await refetch();
              setRefreshing(false);
            }} />
          }
        />
      )}
    </View>
  );
}

const styles = {
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#208AEF',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#208AEF',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
} as any;
