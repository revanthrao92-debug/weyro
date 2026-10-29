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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Input, Button, Chip } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

type RoleOption = 'CUSTOMER' | 'PROVIDER' | 'BOTH';

/** Role carried over from the Login screen's role buttons (Customer/Dealer/Mechanic). */
function roleFromParams(
  roleKey?: string | string[],
  apiRole?: string | string[]
): RoleOption {
  const key = Array.isArray(roleKey) ? roleKey[0] : roleKey;
  const api = Array.isArray(apiRole) ? apiRole[0] : apiRole;
  if (api === 'PROVIDER') return 'PROVIDER';
  if (key === 'DEALER') return 'PROVIDER';
  if (key === 'MECHANIC') return 'PROVIDER';
  return 'CUSTOMER';
}

export default function RegisterScreen() {
  const { roleKey, apiRole } = useLocalSearchParams<{
    roleKey?: string;
    apiRole?: string;
  }>();
  const [form, setForm] = useState<{
    email: string;
    phone: string;
    password: string;
    role: RoleOption;
    firstName: string;
    lastName: string;
    businessName: string;
  }>({
    email: '',
    phone: '',
    password: '',
    role: roleFromParams(roleKey, apiRole),
    firstName: '',
    lastName: '',
    businessName: '',
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleRegister() {
    const { email, phone, password, role, firstName, lastName, businessName } = form;
    if (!email || !phone || !password || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register({
        email,
        phone,
        password,
        role,
        firstName,
        lastName,
        businessName: businessName || undefined,
        providerType:
          role === 'PROVIDER'
            ? roleKey === 'DEALER' || (Array.isArray(roleKey) && roleKey[0] === 'DEALER')
              ? 'DEALER'
              : 'MECHANIC'
            : undefined,
        description:
          role === 'PROVIDER' || role === 'BOTH'
            ? 'Automotive service & parts specialist'
            : undefined,
      });
      router.replace('/(app)');
    } catch (error: any) {
      Alert.alert('Registration failed', error.message || 'Unable to register');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Join Weyro to book repairs and order parts
          </Text>
        </View>

        <View>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(t) => setForm({ ...form, email: t })}
            autoCapitalize="none"
            autoCompleteType="email"
          />
          <Input
            label="Phone"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
            keyboardType="phone-pad"
            autoCompleteType="tel"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={form.password}
            onChangeText={(t) => setForm({ ...form, password: t })}
            secureTextEntry
            autoCompleteType="new-password"
          />
          <Input
            label="First name"
            placeholder="First name"
            value={form.firstName}
            onChangeText={(t) => setForm({ ...form, firstName: t })}
          />
          <Input
            label="Last name"
            placeholder="Last name"
            value={form.lastName}
            onChangeText={(t) => setForm({ ...form, lastName: t })}
          />

          <Text style={styles.label}>Role</Text>
          <View style={styles.roleSelector}>
            {(['CUSTOMER', 'PROVIDER', 'BOTH'] as RoleOption[]).map((r) => (
              <View key={r} style={styles.roleChip}>
                <Chip
                  label={r === 'CUSTOMER' ? 'Customer' : r === 'PROVIDER' ? 'Provider' : 'Both'}
                  selected={form.role === r}
                  onPress={() => setForm({ ...form, role: r })}
                />
              </View>
            ))}
          </View>

          {form.role !== 'CUSTOMER' && (
            <Input
              label="Business name"
              placeholder="e.g. Sharma Motors"
              value={form.businessName}
              onChangeText={(t) => setForm({ ...form, businessName: t })}
            />
          )}
        </View>

        <Button title="Create account" onPress={handleRegister} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="link"
              accessibilityLabel="Log in"
            >
              Log in
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary, marginTop: spacing.sm },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  roleSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChip: { flex: 1, minWidth: 90 },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerText: { ...typography.caption, color: palette.textSecondary },
  link: { ...typography.captionMedium, color: palette.accent },
});
