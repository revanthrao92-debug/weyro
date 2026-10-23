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
      <View style={styles.header}>
        <Text style={styles.title}>
          {purpose === 'reset_password' ? 'Verify OTP' : 'Verify your phone'}
        </Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to {phone || 'your phone'}
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Phone number</Text>
        <Input
          style={styles.input}
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCompleteType="tel"
        />

        <Text style={styles.label}>6-digit code</Text>
        <Input
          style={styles.input}
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoCompleteType="one-time-code"
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>
            {purpose === 'reset_password' ? 'Verify & Continue' : 'Verify'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Didn&apos;t receive a code?{' '}
          <TouchableOpacity onPress={() => Alert.alert('Resend', 'OTP resent')}>
            <Text style={styles.link}>Resend</Text>
          </TouchableOpacity>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280' },
  form: { gap: 20 },
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
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B7280' },
  link: { color: '#208AEF', fontWeight: '600' },
} as any;
