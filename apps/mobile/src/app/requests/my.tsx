import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMyRequests } from '@/hooks/useRequests';

export default function MyRequestsScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const router = useRouter();
  const { data, isLoading, refetch } = useMyRequests();

  const requests = data?.items ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Requests</Text>
        <Text style={styles.subtitle}>Your service requests</Text>
      </View>

      <View style={styles.filterRow}>
        {['OPEN', 'QUOTES_RECEIVED', 'ACCEPTED', 'CANCELLED', 'COMPLETED'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {requests.length === 0 ? (
        <View style={styles.empty}>
          <Text>No requests found</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/requests/create')}>
            <Text style={styles.emptyButtonText}>Create Request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard item={item} onPress={() => router.push(`/requests/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

function RequestCard({ item, onPress }: { item: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <Text style={styles.requestTitle}>{item.title}</Text>
        <Text style={styles.requestCategory}>
          {item.category.charAt(0).toUpperCase() + item.category.slice(1).toLowerCase()}
        </Text>
        <Text style={styles.requestAddress}>{item.address}</Text>
        <Text style={styles.requestStatus}>{item.status}</Text>
      </View>
    </TouchableOpacity>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  filterRow: {
    paddingHorizontal: 16,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardContent: { flex: 1 },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  requestCategory: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  requestAddress: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  requestStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#208AEF',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#208AEF',
    backgroundColor: '#FFFFFF',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#208AEF',
  },
} as any;
