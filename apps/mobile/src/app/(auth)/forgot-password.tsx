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
import { useRouter } from 'expo-router';
import { apiClient } from '@/services/api-client';
import { Input, Button } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSendOtp() {
    if (!phone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      await apiClient('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, purpose: 'reset_password' }),
      });
      Alert.alert('OTP sent', 'A verification code has been sent to your phone.');
      router.push('/(auth)/verify-otp');
    } catch (error: any) {
      Alert.alert('Failed', error.message || 'Unable to send OTP');
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
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>
            Enter your phone number to receive a verification code
          </Text>
        </View>

        <Input
          label="Phone number"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCompleteType="tel"
        />

        <Button title="Send verification code" onPress={handleSendOtp} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Remember your password?{' '}
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
  scrollContent: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: palette.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: palette.textSecondary },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerText: { ...typography.caption, color: palette.textSecondary },
  link: { ...typography.captionMedium, color: palette.accent },
});
