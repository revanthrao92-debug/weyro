import { useEffect, useRef, useState } from 'react';
import {
  View,
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
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { palette, spacing } from '@/theme';

export default function CustomerProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useCustomerProfile();
  const updateProfile = useUpdateCustomerProfile();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);

  // State above is initialized on first render, while `profile` is still
  // undefined (async fetch). Seed the fields once when data arrives, without
  // clobbering later user edits on refetch.
  const seeded = useRef(false);
  useEffect(() => {
    if (!profile || seeded.current) return;
    seeded.current = true;
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setAvatarUrl(profile.avatarUrl ?? '');
  }, [profile]);

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
      <ScreenContainer chrome="dark" padded={false}>
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
      <ScreenContainer chrome="dark" padded={false}>
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
      <ScreenContainer chrome="dark" padded={false}>
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
