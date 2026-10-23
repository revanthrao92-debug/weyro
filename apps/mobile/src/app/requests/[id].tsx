import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRequest, useRequestQuotations, useCancelRequest, useAcceptQuotation } from '@/hooks/useRequests';

type RequestParams = { id: string };

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<RequestParams>();
  const { data: request, isLoading } = useRequest(id || '');
  const { data: quotesData, isLoading: quotesLoading } = useRequestQuotations(id || '');
  const cancelRequest = useCancelRequest();
  const acceptQuotation = useAcceptQuotation();

  const quotes = quotesData?.items ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>Request not found</Text>
      </View>
    );
  }

  const canCancel = request.status === 'OPEN' || request.status === 'QUOTES_RECEIVED';
  const canAccept = quotes.some((q) => q.status === 'PENDING');

  const handleCancel = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Cancel Request',
        'Are you sure you want to cancel this request?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cancel Request', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;
    try {
      await cancelRequest.mutateAsync(request.id);
      Alert.alert('Success', 'Request cancelled');
      router.replace('/requests/my');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to cancel request');
    }
  };

  const handleAccept = async (quotation: any) => {
    try {
      await acceptQuotation.mutateAsync({
        quotationId: quotation.id,
        data: {},
      });
      Alert.alert('Success', 'Quotation accepted. Booking created!');
      router.replace(`/bookings/placeholder`);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to accept quotation');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Request #{request.id.slice(0, 8)}</Text>
        <StatusBadge status={request.status} />
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Request Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>
              {request.category.charAt(0).toUpperCase() + request.category.slice(1).toLowerCase()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Title</Text>
            <Text style={styles.detailValue}>{request.title}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailValue}>{request.description}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>{request.address}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Urgency</Text>
            <Text style={styles.detailValue}>{request.urgency}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue}>{request.status}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quotes ({quotes.length})</Text>
          {quotes.length === 0 ? (
            <Text style={styles.emptyQuotes}>No quotes yet</Text>
          ) : (
            <FlatList
              data={quotes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <QuoteCard quote={item} onAccept={handleAccept} />
              )}
            />
          )}
        </View>

        {canCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <Text style={[styles.badgeText, { color: color.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
      </Text>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return { bg: '#EFF6FF', text: '#208AEF' };
    case 'QUOTES_RECEIVED': return { bg: '#FFF7ED', text: '#F59E0B' };
    case 'ACCEPTED': return { bg: '#ECFDF5', text: '#10B981' };
    case 'CANCELLED': return { bg: '#FEF2F2', text: '#EF4444' };
    case 'COMPLETED': return { bg: '#ECFDF5', text: '#10B981' };
    default: return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

function QuoteCard({ quote, onAccept }: { quote: any; onAccept: (q: any) => void }) {
  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteInfo}>
        <Text style={styles.quoteProvider}>Provider</Text>
        <Text style={styles.quoteAmount}>₹{quote.totalCost.toLocaleString()}</Text>
        <Text style={styles.quoteStatus}>{quote.status}</Text>
        {quote.warrantyDays !== undefined && (
          <Text style={styles.quoteWarranty}>{quote.warrantyDays} days warranty</Text>
        )}
      </View>
      <TouchableOpacity style={styles.acceptButton} onPress={() => onAccept(quote)}>
        <Text style={styles.acceptText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  emptyQuotes: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteInfo: { flex: 1 },
  quoteProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  quoteAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  quoteStatus: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  quoteWarranty: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  acceptText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cancelText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
} as any;
