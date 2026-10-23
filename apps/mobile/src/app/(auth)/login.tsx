import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Input, Button } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Weyro account</Text>
        </View>

        <View>
          <Input
            label="Email or phone"
            placeholder="you@example.com"
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
            autoCapitalize="none"
            autoCompleteType="email"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCompleteType="password"
          />
        </View>

        <Button title="Log in" onPress={handleLogin} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don&apos;t have an account?{' '}
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="link"
              accessibilityLabel="Register"
            >
              Register
            </Text>
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            accessibilityRole="link"
            accessibilityLabel="Forgot password"
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: palette.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: palette.textSecondary },
  footer: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footerText: { ...typography.caption, color: palette.textSecondary },
  link: { ...typography.captionMedium, color: palette.accent },
});
