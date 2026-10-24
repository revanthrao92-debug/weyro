import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';import { useAuth } from '@/hooks/useAuth';
import {
  useProviderProfile,
  useUpdateProviderProfile,
} from '@/hooks/useProfile';
import {
  Input,
  Button,
  ScreenContainer,
  AppHeader,
  Card,
  Avatar,
  StatusPill,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { StatusTone, palette, spacing, radii, typography } from '@/theme';

export default function ProviderProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProviderProfile();
  const updateProfile = useUpdateProviderProfile();
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState(profile?.businessName ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(
    profile?.serviceRadiusKm?.toString() ?? ''
  );
  const [isAvailable, setIsAvailable] = useState(profile?.isAvailable ?? true);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        businessName: businessName || undefined,
        description: description || undefined,
        phone: phone || undefined,
        address: address || undefined,
        serviceRadiusKm: serviceRadiusKm
          ? parseFloat(serviceRadiusKm)
          : undefined,
        isAvailable,
      });
      Alert.alert('Success', 'Provider profile updated');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer padded={false}>
        <AppHeader title="Provider Profile" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer padded={false}>
        <AppHeader title="Provider Profile" />
        <EmptyState
          title="No provider profile found"
          message="Your provider profile will appear here."
        />
      </ScreenContainer>
    );
  }

  function statusTone(status: string): StatusTone {
    switch (status) {
      case 'VERIFIED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
        return 'danger';
      case 'SUSPENDED':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer padded={false}>
        <AppHeader title="Provider Profile" subtitle="Manage your business information" />
        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar name={businessName} size={72} />
              <View style={styles.profileText}>
                <Text style={styles.businessName}>{businessName}</Text>
                <StatusPill
                  label={profile.verificationStatus.charAt(0).toUpperCase() + profile.verificationStatus.slice(1).toLowerCase()}
                  tone={statusTone(profile.verificationStatus)}
                />
                <Text style={styles.providerType}>{profile.providerType}</Text>
              </View>
            </View>
          </Card>

          <View style={styles.form}>
            <Input
              label="Business name"
              placeholder="Business name"
              value={businessName}
              onChangeText={setBusinessName}
            />
            <Input
              label="Description"
              placeholder="Describe your services"
              value={description}
              onChangeText={setDescription}
            />
            <Input
              label="Phone"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Street address"
              placeholder="Street address"
              value={address}
              onChangeText={setAddress}
            />
            <Input
              label="Service Radius (km)"
              placeholder="15"
              value={serviceRadiusKm}
              onChangeText={setServiceRadiusKm}
              keyboardType="numeric"
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Available for bookings</Text>
              <TouchableOpacity
                style={[styles.toggle, isAvailable && styles.toggleActive]}
                onPress={() => setIsAvailable(!isAvailable)}
                accessibilityRole="switch"
                accessibilityState={{ checked: isAvailable }}
                accessibilityLabel="Available for bookings"
              >
                <Text style={[styles.toggleText, isAvailable && styles.toggleTextActive]}>
                  {isAvailable ? 'Online' : 'Offline'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.stats}>
            <StatItem label="Rating" value={profile.avgRating.toFixed(1)} />
            <StatItem label="Reviews" value={profile.totalReviews.toString()} />
            <StatItem label="Jobs" value={profile.completedJobs.toString()} />
            {profile.counts?.listings !== undefined && (
              <StatItem label="Listings" value={profile.counts.listings.toString()} />
            )}
          </View>

          <Button
            title="Save changes"
            onPress={handleSave}
            disabled={saving}
            loading={saving}
          />
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
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
  profileCard: { marginBottom: spacing.md },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileText: { flex: 1 },
  businessName: { ...typography.heading, color: palette.textPrimary },
  providerType: { ...typography.caption, color: palette.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.md },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: palette.textPrimary, flex: 1, marginRight: spacing.md },
  toggle: {
    minWidth: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  toggleText: { ...typography.label, color: palette.textSecondary },
  toggleTextActive: { color: palette.accent },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...Platform.select({
      android: { elevation: 1 },
      default: {},
    }),
  },
  statItem: { alignItems: 'center' },
  statValue: {
    ...typography.heading,
    color: palette.textPrimary,
  },
  statLabel: { ...typography.label, color: palette.textSecondary, marginTop: spacing.xs },
});
