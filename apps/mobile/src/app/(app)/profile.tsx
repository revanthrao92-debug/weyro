import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/useProfile';
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
      <ScreenContainer padded={false}>
        <AppHeader title="Profile" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="100%" height={18} />
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
        </Card>
        <Card style={styles.skeletonCard}>
          <Skeleton width="100%" height={14} style={{ marginTop: spacing.sm }} />
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
        <AppHeader title="Profile" />
        <EmptyState title="No profile found" message="Your profile will appear here." />
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer padded={false}>
        <AppHeader title="Profile" subtitle="Manage your personal information" />
        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.avatarCard}>
            <View style={styles.avatarRow}>
              <Avatar name={`${firstName} ${lastName}`} size={80} />
              <Input
                label="Avatar URL"
                placeholder="Avatar URL"
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                style={styles.avatarInput}
              />
            </View>
          </Card>

          <View style={styles.form}>
            <Input
              label="First Name"
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
            />
            <Input
              label="Last Name"
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
            />
            <Input
              label="Email"
              placeholder="you@example.com"
              value={user?.email ?? ''}
              editable={false}
            />
            <Input
              label="Phone"
              placeholder="+91 98765 43210"
              value={user?.phone ?? ''}
              editable={false}
            />
          </View>

          <Button title="Save changes" onPress={handleSave} disabled={saving} loading={saving} />
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  avatarCard: { marginBottom: spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarInput: { flex: 1 },
  form: { gap: spacing.md },
});
