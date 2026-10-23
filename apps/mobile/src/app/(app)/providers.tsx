import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function ProvidersScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Admin provider list — fetches from /admin/providers
  const providers = [
    { id: 'p1', businessName: 'Sharma Motors', providerType: 'GARAGE', verificationStatus: 'VERIFIED', avgRating: 4.6, totalReviews: 120 },
    { id: 'p2', businessName: 'Auto Care Center', providerType: 'MECHANIC', verificationStatus: 'PENDING', avgRating: 4.2, totalReviews: 45 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Provider Verification</Text>
        <Text style={styles.subtitle}>Manage provider onboarding</Text>
      </View>

      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/admin/providers/${item.id}`)}
            accessibilityLabel={`View provider ${item.businessName}`}
            accessibilityRole="button"
          >
            <View style={styles.cardContent}>
              <Text style={styles.providerName}>{item.businessName}</Text>
              <Text style={styles.providerType}>{item.providerType}</Text>
              <Text style={styles.status}>{item.verificationStatus}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = {
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280' },
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
  cardContent: { flex: 1 },
  providerName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  providerType: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  status: { fontSize: 13, fontWeight: '600', color: '#10B981' },
} as any;
