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
import { useParts } from '@/hooks/useParts';
import { Input } from '@/components/ui/Input';

export default function ShopScreen() {
  const [search, setSearch] = useState('');
  const [make, setMake] = useState('');
  const router = useRouter();
  const { data, isLoading, refetch } = useParts({ search, make });

  const parts = data?.items ?? [];

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
        <Text style={styles.title}>Spare Parts</Text>
        <Text style={styles.subtitle}>Genuine parts &amp; accessories</Text>
      </View>

      <View style={styles.filterBar}>
        <Input
          style={styles.searchInput}
          placeholder="Search parts..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="words"
        />
        <Input
          style={styles.makeInput}
          placeholder="Make (e.g. Maruti)"
          value={make}
          onChangeText={setMake}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.filterButton} onPress={() => refetch()}>
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {parts.length === 0 ? (
        <View style={styles.empty}>
          <Text>No parts found</Text>
        </View>
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PartCard part={item} onPress={() => router.push(`/shop/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

function PartCard({ part, onPress }: { part: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imageText}>🔧</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.partName}>{part.name}</Text>
          <Text style={styles.partNumber}>{part.partNumber}</Text>
          <Text style={styles.condition}>
            {part.condition.charAt(0).toUpperCase() + part.condition.slice(1)}
          </Text>
        </View>
        <View style={styles.priceStock}>
          <Text style={styles.price}>₹{part.price.toLocaleString()}</Text>
          <StockBadge stock={part.stockQuantity} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StockBadge({ stock }: { stock: number }) {
  const color = stock > 0 ? '#10B981' : '#EF4444';
  const label = stock > 0 ? `In Stock (${stock})` : 'Out of Stock';
  return (
    <View style={[styles.stockBadge, { backgroundColor: color + '1a' }]}>
      <Text style={[styles.stockText, { color }]}>{label}</Text>
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
  filterBar: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 2,
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  makeInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  filterButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: 70,
  },
  filterButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  imageText: {
    fontSize: 24,
  },
  info: { flex: 1 },
  partName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  partNumber: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  condition: {
    fontSize: 12,
    fontWeight: '600',
    color: '#208AEF',
  },
  priceStock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
} as any;
