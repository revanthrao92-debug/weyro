import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePublicProvider, useProviderReviews } from '@/hooks/useProfile';
import {
  Button,
  ScreenContainer,
  AppHeader,
  Card,
  Avatar,
  StatusPill,
  EmptyState,
  Skeleton,
  BackButton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

type ProviderParams = { id: string };

export default function ProviderProfilePublicScreen() {
  const { id } = useLocalSearchParams<ProviderParams>();
  const { data: provider, isLoading } = usePublicProvider(id || '');
  const { data: reviewsData } = useProviderReviews(id || '');

  const reviews = reviewsData?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Provider" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="100%" height={20} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScreenContainer>
    );
  }

  if (!provider) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Provider" />
        <EmptyState title="Provider not found" message="This provider may have been removed." />
      </ScreenContainer>
    );
  }

  const handleStartChat = () => {
    Alert.alert(
      'Start Chat',
      'Chat functionality will connect you with this provider.'
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScreenContainer chrome="dark" safeBottom padded={false}>
        <AppHeader left={<BackButton />} title={provider.businessName} subtitle={provider.providerType} />
        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <Avatar name={provider.businessName} size={64} />
              <View style={styles.info}>
                <Text style={styles.businessName}>{provider.businessName}</Text>
                <Text style={styles.providerType}>{provider.providerType}</Text>
                {provider.badge && (
                  <StatusPill label={provider.badge} tone="neutral" />
                )}
              </View>
            </View>
          </Card>

          <View style={styles.stats}>
            <StatItem value={provider.avgRating.toFixed(1)} label="Rating" />
            <StatItem value={provider.totalReviews.toString()} label="Reviews" />
            <StatItem value={provider.completedJobs.toString()} label="Jobs Completed" />
          </View>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{provider.description}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Service Radius</Text>
              <Text style={styles.metaValue}>{provider.serviceRadiusKm} km</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Availability</Text>
              <Text style={styles.metaValue}>
                {provider.isAvailable ? 'Available' : 'Not Available'}
              </Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Customer Reviews ({reviews.length})</Text>
            {reviews.length === 0 ? (
              <EmptyState title="No reviews yet" message="Customer reviews will appear here." />
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((r: any) => (
                  <View key={r.id} style={styles.reviewItem}>
                    <Text style={styles.reviewCustomer}>{r.customerName}</Text>
                    <Text style={styles.reviewRating}>★ {r.rating}</Text>
                    <Text style={styles.reviewComment}>{r.comment || ''}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button
            title="Start Chat"
            onPress={handleStartChat}
            accessibilityLabel="Start chat with provider"
          />
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  headerCard: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1 },
  businessName: { ...typography.heading, color: palette.textPrimary },
  providerType: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...(Platform.OS === 'android' ? { elevation: 1 } : {}),
  },
  statItem: { alignItems: 'center' },
  statValue: { ...typography.heading, color: palette.textPrimary },
  statLabel: { ...typography.label, color: palette.textSecondary, marginTop: spacing.xs },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  description: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  metaLabel: { ...typography.caption, color: palette.textSecondary },
  metaValue: { ...typography.captionMedium, color: palette.textPrimary },
  reviewsList: { gap: spacing.sm },
  reviewItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceAlt,
  },
  reviewCustomer: { ...typography.bodyMedium, color: palette.textPrimary, marginBottom: spacing.xs },
  reviewRating: { ...typography.captionMedium, color: palette.textPrimary, marginBottom: spacing.xs },
  reviewComment: { ...typography.body, color: palette.textSecondary },
});
