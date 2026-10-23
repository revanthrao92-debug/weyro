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
import { useRouter } from 'expo-router';
import { Input, Button } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

export default function VerifyOtpScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [purpose, setPurpose] = useState<'login' | 'reset_password'>('login');
  const [loading, setLoading] = useState(false);
  const { verifyOtp, resetPassword } = useAuth();
  const router = useRouter();

  async function handleVerify() {
    if (!phone || !code) {
      Alert.alert('Error', 'Please enter phone and OTP code');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, code, purpose);
      if (purpose === 'reset_password') {
        router.push('/(auth)/reset-password');
      } else {
        router.replace('/(app)');
      }
    } catch (error: any) {
      Alert.alert('Verification failed', error.message || 'Invalid OTP');
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
          <Text style={styles.title}>
            {purpose === 'reset_password' ? 'Verify OTP' : 'Verify your phone'}
          </Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to {phone || 'your phone'}
          </Text>
        </View>

        <View>
          <Input
            label="Phone number"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCompleteType="tel"
          />
          <Input
            label="6-digit code"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoCompleteType="one-time-code"
          />
        </View>

        <Button
          title={purpose === 'reset_password' ? 'Verify & Continue' : 'Verify'}
          onPress={handleVerify}
          loading={loading}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Didn&apos;t receive a code?{' '}
            <Text
              style={styles.link}
              onPress={() => Alert.alert('Resend', 'OTP resent')}
              accessibilityRole="button"
              accessibilityLabel="Resend code"
            >
              Resend
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
