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
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';

type RoleOption = 'CUSTOMER' | 'PROVIDER' | 'BOTH';

export default function RegisterScreen() {
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
    role: 'CUSTOMER',
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
        providerType: role === 'PROVIDER' ? 'MECHANIC' : undefined,
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

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <Input
            style={styles.input}
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(t) => setForm({ ...form, email: t })}
            autoCapitalize="none"
            autoCompleteType="email"
          />

          <Text style={styles.label}>Phone</Text>
          <Input
            style={styles.input}
            placeholder="+91 98765 43210"
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
            keyboardType="phone-pad"
            autoCompleteType="tel"
          />

          <Text style={styles.label}>Password</Text>
          <Input
            style={styles.input}
            placeholder="••••••••"
            value={form.password}
            onChangeText={(t) => setForm({ ...form, password: t })}
            secureTextEntry
            autoCompleteType="new-password"
          />

          <Text style={styles.label}>First Name</Text>
          <Input
            style={styles.input}
            placeholder="First name"
            value={form.firstName}
            onChangeText={(t) => setForm({ ...form, firstName: t })}
          />

          <Text style={styles.label}>Last Name</Text>
          <Input
            style={styles.input}
            placeholder="Last name"
            value={form.lastName}
            onChangeText={(t) => setForm({ ...form, lastName: t })}
          />

          <Text style={styles.label}>Role</Text>
          <View style={styles.roleSelector}>
            {['CUSTOMER', 'PROVIDER', 'BOTH'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleOption,
                  form.role === r && styles.roleOptionSelected,
                ]}
                onPress={() => setForm({ ...form, role: r as RoleOption })}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    form.role === r && styles.roleOptionTextSelected,
                  ]}
                >
                  {r === 'CUSTOMER' ? 'Customer' : r === 'PROVIDER' ? 'Provider' : 'Both'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {form.role !== 'CUSTOMER' && (
            <>
              <Text style={styles.label}>Business Name</Text>
              <Input
                style={styles.input}
                placeholder="e.g. Sharma Motors"
                value={form.businessName}
                onChangeText={(t) => setForm({ ...form, businessName: t })}
              />
            </>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.link}>Log in</Text>
            </TouchableOpacity>
          </Text>
        </View>
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
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleOption: {
    flex: 1,
    minWidth: 90,
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  roleOptionSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#EFF6FF',
  },
  roleOptionText: { fontSize: 14, color: '#6B7280' },
  roleOptionTextSelected: { color: '#208AEF', fontWeight: '600' },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B7280' },
  link: { color: '#208AEF', fontWeight: '600' },
} as any;
