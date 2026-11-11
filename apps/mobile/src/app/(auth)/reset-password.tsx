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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Input, Button, BackButton } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(phoneParam ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleReset() {
    if (!phone || !code || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(phone, code, newPassword);
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Reset failed', error.message || 'Unable to reset password');
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
        <View style={[styles.backRow, { paddingTop: insets.top }]}>
          <BackButton />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter your OTP and choose a new password
          </Text>
        </View>

        <View>
          <Input
            label="Phone number"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Input
            label="Verification code"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Input
            label="New password"
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
        </View>

        <Button title="Reset password" onPress={handleReset} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  backRow: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  scrollContent: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: palette.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: palette.textSecondary },
});
