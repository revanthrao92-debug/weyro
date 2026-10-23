import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  useProviderProfile,
  useUpdateProviderProfile,
  type ProviderProfile,
} from '@/hooks/useProfile';
import { Input } from '@/components/ui/Input';

export default function ProviderProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProviderProfile();
const updateProfile = useUpdateProviderProfile();
  const [saving, setSaving] = useState(false);

  // Form state
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>No provider profile found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Provider Profile</Text>
          <Text style={styles.subtitle}>Manage your business information</Text>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {businessName.charAt(0)}
            </Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.businessName}>{businessName}</Text>
            <StatusBadge status={profile.verificationStatus} />
            <Text style={styles.providerType}>{profile.providerType}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Business Name</Text>
          <Input
            style={styles.input}
            placeholder="Business name"
            value={businessName}
            onChangeText={setBusinessName}
          />

          <Text style={styles.label}>Description</Text>
          <Input
            style={styles.input}
            placeholder="Describe your services"
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Phone</Text>
          <Input
            style={styles.input}
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Address</Text>
          <Input
            style={styles.input}
            placeholder="Street address"
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Service Radius (km)</Text>
          <Input
            style={styles.input}
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

        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    case 'VERIFIED': return { bg: '#ECFDF5', text: '#10B981' };
    case 'PENDING': return { bg: '#FFF7ED', text: '#F59E0B' };
    case 'REJECTED': return { bg: '#FEF2F2', text: '#EF4444' };
    case 'SUSPENDED': return { bg: '#F3F4F6', text: '#6B7280' };
    default: return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, minHeight: '100%', gap: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  profileInfo: {
    gap: 12,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#208AEF',
  },
  info: { gap: 4 },
  businessName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  providerType: {
    fontSize: 14,
    color: '#6B7280',
  },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    color: '#374151',
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  toggleActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
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
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
} as any;
