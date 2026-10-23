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
import { useMyQuotations, useWithdrawQuotation } from '@/hooks/useRequests';

export default function MyQuotesScreen() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const router = useRouter();
  const { data, isLoading, refetch } = useMyQuotations({ status: statusFilter });
  const withdrawQuotation = useWithdrawQuotation();

  const quotes = data?.items ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  const handleWithdraw = async (id: string) => {
    try {
      await withdrawQuotation.mutateAsync(id);
      Alert.alert('Success', 'Quotation withdrawn');
      await refetch();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to withdraw quotation');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Quotes</Text>
        <Text style={styles.subtitle}>Your sent quotations</Text>
      </View>

      <View style={styles.filterRow}>
        {['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'].map((s) => (
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

      {quotes.length === 0 ? (
        <View style={styles.empty}>
          <Text>No quotes yet</Text>
        </View>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QuoteItem item={item} onWithdraw={handleWithdraw} />
          )}
        />
      )}
    </View>
  );
}

function QuoteItem({ item, onWithdraw }: { item: any; onWithdraw: (id: string) => void }) {
  const canWithdraw = item.status === 'PENDING';

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.quoteTitle}>Quotation</Text>
        <Text style={styles.quoteAmount}>₹{item.totalCost.toLocaleString()}</Text>
        <Text style={styles.quoteStatus}>{item.status}</Text>
        <Text style={styles.quoteETA}>{item.etaDescription}</Text>
      </View>
      {canWithdraw && (
        <TouchableOpacity style={styles.withdrawButton} onPress={() => onWithdraw(item.id)}>
          <Text style={styles.withdrawText}>Withdraw</Text>
        </TouchableOpacity>
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
  quoteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  quoteAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  quoteStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#208AEF',
    marginBottom: 4,
  },
  quoteETA: {
    fontSize: 13,
    color: '#6B7280',
  },
  withdrawButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  withdrawText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
} as any;
