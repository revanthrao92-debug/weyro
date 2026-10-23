import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!emailOrPhone || !password) {
      Alert.alert('Error', 'Please enter both email/phone and password');
      return;
    }
    setLoading(true);
    try {
      await login(emailOrPhone, password);
      router.replace('/(app)');
    } catch (error: any) {
      Alert.alert('Login failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your Weyro account</Text>
      </View>

      <View style={styles.form}>
        <Input
          style={styles.input}
          placeholder="Email or phone"
          value={emailOrPhone}
          onChangeText={setEmailOrPhone}
          autoCapitalize="none"
          autoCompleteType="email"
        />
        <Input
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCompleteType="password"
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Don&apos;t have an account?{' '}
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.link}>Register</Text>
          </TouchableOpacity>
        </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 24 },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280' },
  form: { gap: 16 },
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
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 24, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  footerText: { fontSize: 14, color: '#6B7280' },
  link: { color: '#208AEF', fontWeight: '600' },
} as any;
