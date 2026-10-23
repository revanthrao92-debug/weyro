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
import { useBroadcastFeed, useCreateQuotation } from '@/hooks/useRequests';

export default function BroadcastFeedScreen() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const router = useRouter();
  const { data, isLoading, refetch } = useBroadcastFeed({ category: categoryFilter });
  const createQuotation = useCreateQuotation();

  const requests = data?.items ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
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
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Opportunities</Text>
        <Text style={styles.subtitle}>Nearby service requests</Text>
      </View>

      <View style={styles.filterRow}>
        {['REPAIR', 'MAINTENANCE', 'SPARE_PART', 'TOWING', 'ROADSIDE', 'INSPECTION'].map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.filterChip, categoryFilter === c && styles.filterChipActive]}
            onPress={() => setCategoryFilter(c)}
          >
            <Text style={[styles.filterText, categoryFilter === c && styles.filterTextActive]}>
              {c.charAt(0).toUpperCase() + c.slice(1).toLowerCase().replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {requests.length === 0 ? (
        <View style={styles.empty}>
          <Text>No requests found</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedRequestCard item={item} onQuote={handleQuote} />
          )}
        />
      )}
    </View>
  );
}

function FeedRequestCard({ item, onQuote }: { item: any; onQuote: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.requestTitle}>{item.title}</Text>
        <Text style={styles.requestCategory}>
          {item.category.charAt(0).toUpperCase() + item.category.slice(1).toLowerCase()}
        </Text>
        <Text style={styles.requestAddress}>{item.address}</Text>
        <Text style={[styles.requestUrgency, { color: item.urgency === 'EMERGENCY' ? '#EF4444' : '#9CA3AF' }]}>
          {item.urgency}
        </Text>
      </View>
      <TouchableOpacity style={styles.quoteButton} onPress={() => onQuote(item.id)}>
        <Text style={styles.quoteText}>Quote</Text>
      </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1 },
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
  requestUrgency: {
    fontSize: 12,
    fontWeight: '600',
    color: (p: { urgency: string }) => (p.urgency === 'EMERGENCY' ? '#EF4444' : '#9CA3AF'),
  },
  quoteButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quoteText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
} as any;
