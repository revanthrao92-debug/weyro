import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePublicProvider, useProviderReviews } from '@/hooks/useProfile';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type ProviderParams = { id: string };

export default function ProviderProfilePublicScreen() {
  const { id } = useLocalSearchParams<ProviderParams>();
  const { data: provider, isLoading } = usePublicProvider(id || '');
  const { data: reviewsData } = useProviderReviews(id || '');

  const reviews = reviewsData?.items ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>Provider not found</Text>
      </View>
    );
  }

  const handleStartChat = () => {
    Alert.alert(
      'Start Chat',
      'Chat functionality will connect you with this provider.'
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ padding: 20 }}>
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{provider.businessName.charAt(0)}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.businessName}>{provider.businessName}</Text>
            <Text style={styles.providerType}>{provider.providerType}</Text>
            {provider.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{provider.badge}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.stats}>
          <Text style={styles.statValue}>{provider.avgRating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
          <Text style={styles.statValue}>{provider.totalReviews}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
          <Text style={styles.statValue}>{provider.completedJobs}</Text>
          <Text style={styles.statLabel}>Jobs Completed</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{provider.description}</Text>
          <Text style={styles.sectionTitle}>Service Radius</Text>
          <Text style={styles.detailValue}>
            {provider.serviceRadiusKm} km
          </Text>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.detailValue}>
            {provider.isAvailable ? 'Available' : 'Not Available'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyReviews}>No reviews yet</Text>
          ) : (
            reviews.map((r: any) => (
              <View key={r.id} style={styles.reviewItem}>
                <Text style={styles.reviewCustomer}>{r.customerName}</Text>
                <Text style={styles.reviewRating}>&{'>'.repeat(r.rating)}</Text>
                <Text style={styles.reviewComment}>{r.comment || ''}</Text>
              </View>
            ))
          )}
        </View>

        <Button
          title="Start Chat"
          onPress={handleStartChat}
          accessibilityLabel="Start chat with provider"
        />
      </View>
    </ScrollView>
  );
}

const styles = {
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#208AEF',
  },
  info: { flex: 1 },
  businessName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  providerType: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  emptyReviews: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  reviewItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewCustomer: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  reviewRating: {
    fontSize: 14,
    color: '#F59E0B',
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
  },
} as any;
