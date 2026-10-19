import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authStore, useAuth } from '@/services/auth-store';
import { UserRole } from '@weyro/api-contracts';

export default function AuthScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'LOGIN') {
        if (!emailOrPhone.trim()) {
          Alert.alert('Required', 'Please enter your email address or phone number.');
          setSubmitting(false);
          return;
        }
        if (!password.trim()) {
          Alert.alert('Required', 'Please enter your password.');
          setSubmitting(false);
          return;
        }
        await authStore.login({
          emailOrPhone: emailOrPhone.trim(),
          password: password.trim(),
        });
        Alert.alert('Signed In', `Welcome back!`);
      } else {
        if (!email.trim() || !email.includes('@')) {
          Alert.alert('Invalid Email', 'Please enter a valid email address.');
          setSubmitting(false);
          return;
        }
        if (!phone.trim() || phone.trim().length < 10) {
          Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
          setSubmitting(false);
          return;
        }
        if (!password.trim() || password.length < 8) {
          Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
          setSubmitting(false);
          return;
        }
        if (!name.trim()) {
          Alert.alert('Name Required', 'Please enter your full name.');
          setSubmitting(false);
          return;
        }
        await authStore.register({
          email: email.trim(),
          phone: phone.trim().startsWith('+91') ? phone.trim() : `+91${phone.trim()}`,
          password: password.trim(),
          role: selectedRole,
          name: name.trim(),
          businessName: businessName.trim() || undefined,
        });
        Alert.alert('Account Created', `Registered as ${selectedRole}!`);
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Authentication Failed', err?.message || 'Could not complete login/registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          authStore.logout();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.two,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header with Back */}
        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <ThemedText style={styles.backBtnText}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText style={styles.navTitle}>Account & Identity</ThemedText>
          <View style={{ width: 50 }} />
        </View>

        {/* Current Active User Status Card */}
        {auth.isAuthenticated ? (
          <ThemedView type="backgroundElement" style={styles.activeCard}>
            <ThemedText style={styles.sectionHeading}>AUTHENTICATED USER</ThemedText>
            <ThemedText style={styles.activeName}>{auth.user.name}</ThemedText>
            <ThemedText style={styles.activeEmail}>{auth.user.email}</ThemedText>
            {auth.user.phone ? (
              <ThemedText style={styles.activePhone}>{auth.user.phone}</ThemedText>
            ) : null}
            <View style={styles.roleTag}>
              <ThemedText style={styles.roleTagText}>{auth.user.role}</ThemedText>
            </View>

            <Pressable
              style={styles.logoutBtn}
              onPress={handleLogout}>
              <ThemedText style={styles.logoutBtnText}>Sign Out</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {/* Auth Form */}
        {!auth.isAuthenticated && (
          <ThemedView type="backgroundElement" style={styles.formCard}>
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeTab, mode === 'LOGIN' && styles.modeTabActive]}
                onPress={() => setMode('LOGIN')}>
                <ThemedText
                  style={[
                    styles.modeTabText,
                    mode === 'LOGIN' && styles.modeTabTextActive,
                  ]}>
                  Sign In
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modeTab, mode === 'REGISTER' && styles.modeTabActive]}
                onPress={() => setMode('REGISTER')}>
                <ThemedText
                  style={[
                    styles.modeTabText,
                    mode === 'REGISTER' && styles.modeTabTextActive,
                  ]}>
                  Create Account
                </ThemedText>
              </Pressable>
            </View>

            {mode === 'LOGIN' ? (
              <>
                <ThemedText style={styles.inputLabel}>Email or Phone Number</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.backgroundElement },
                  ]}
                  placeholder="e.g. rohan.sharma@example.in or +919845012345"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                />

                <ThemedText style={styles.inputLabel}>Password</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.backgroundElement },
                  ]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </>
            ) : (
              <>
                <ThemedText style={styles.inputLabel}>Full Name</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.backgroundElement },
                  ]}
                  placeholder="e.g. Rohan Sharma"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                />

                <ThemedText style={styles.inputLabel}>Email Address</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.backgroundElement },
                  ]}
                  placeholder="your.email@example.in"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <ThemedText style={styles.inputLabel}>Mobile Phone (+91)</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.backgroundElement },
                  ]}
                  placeholder="e.g. 9845012345"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />

                <ThemedText style={styles.inputLabel}>Password (Min 8 characters)</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.backgroundElement },
                  ]}
                  placeholder="Create a secure password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <ThemedText style={styles.inputLabel}>Account Type</ThemedText>
                <View style={styles.rolePickerRow}>
                  {(['CUSTOMER', 'PROVIDER'] as const).map((r) => (
                    <Pressable
                      key={r}
                      style={[
                        styles.roleChoice,
                        selectedRole === r && styles.roleChoiceActive,
                      ]}
                      onPress={() => setSelectedRole(r)}>
                      <ThemedText
                        style={[
                          styles.roleChoiceText,
                          selectedRole === r && styles.roleChoiceTextActive,
                        ]}>
                        {r === 'CUSTOMER' ? 'Vehicle Owner' : 'Garage / Parts Dealer'}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {selectedRole === 'PROVIDER' && (
                  <>
                    <ThemedText style={styles.inputLabel}>
                      Workshop / Business Name
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.textInput,
                        { color: theme.text, borderColor: theme.backgroundElement },
                      ]}
                      placeholder="e.g. Bengaluru Motor Works & Spares"
                      placeholderTextColor={theme.textSecondary}
                      value={businessName}
                      onChangeText={setBusinessName}
                    />
                  </>
                )}
              </>
            )}

            <Pressable
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.submitBtnText}>
                  {mode === 'LOGIN' ? 'Sign In' : 'Create Account'}
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  activeCard: {
    padding: Spacing.three,
    borderRadius: 16,
    marginBottom: Spacing.three,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  activeName: {
    fontSize: 20,
    fontWeight: '800',
  },
  activeEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  activePhone: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 10,
  },
  roleTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: Spacing.three,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    padding: Spacing.three,
    borderRadius: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 3,
    marginBottom: Spacing.three,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeTabTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: Spacing.two,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  roleChoice: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChoiceActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  roleChoiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  roleChoiceTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: Spacing.three,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
