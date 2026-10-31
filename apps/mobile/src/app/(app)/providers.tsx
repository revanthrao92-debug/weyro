import { FlatList, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ListItem,
  StatusPill,
  ScreenContainer,
  AppHeader,
} from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

export default function ProvidersScreen() {
  const router = useRouter();

  // Admin provider list — fetches from /admin/providers
  const providers = [
    { id: 'p1', businessName: 'Sharma Motors', providerType: 'GARAGE', verificationStatus: 'VERIFIED', avgRating: 4.6, totalReviews: 120 },
    { id: 'p2', businessName: 'Auto Care Center', providerType: 'MECHANIC', verificationStatus: 'PENDING', avgRating: 4.2, totalReviews: 45 },
  ];

  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Provider Verification" subtitle="Manage provider onboarding" />

      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ListItem
            title={item.businessName}
            subtitle={item.providerType}
            right={
              <View style={styles.meta}>
                <StatusPill label={item.verificationStatus} tone="info" />
                <Text style={styles.rating}>{item.avgRating} ★ · {item.totalReviews} reviews</Text>
              </View>
            }
            onPress={() => router.push(`/provider/${item.id}`)}
            accessibilityLabel={`View provider ${item.businessName}`}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rating: { ...typography.caption, color: palette.textMuted },
});
