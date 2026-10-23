import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/useProfile';
import { Input } from '@/components/ui/Input';

export default function CustomerProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useCustomerProfile();
const updateProfile = useUpdateCustomerProfile();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        avatarUrl: avatarUrl || null,
      });
      Alert.alert('Success', 'Profile updated');
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your personal information</Text>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {firstName.charAt(0)}{lastName.charAt(0)}
            </Text>
          </View>
          <Input
            style={styles.input}
            placeholder="Avatar URL"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
          />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>First Name</Text>
          <Input
            style={styles.input}
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={styles.label}>Last Name</Text>
          <Input
            style={styles.input}
            placeholder="Last name"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.label}>Email</Text>
          <Input
            style={styles.input}
            placeholder="you@example.com"
            value={user?.email ?? ''}
            editable={false}
          />

          <Text style={styles.label}>Phone</Text>
          <Input
            style={styles.input}
            placeholder="+91 98765 43210"
            value={user?.phone ?? ''}
            editable={false}
          />
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

const styles = {
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, minHeight: '100%', gap: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  avatarSection: {
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
    fontSize: 20,
    fontWeight: '700',
    color: '#208AEF',
  },
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
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
} as any;
