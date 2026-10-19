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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [submitting, setSubmitting] = useState(false);

  const handleQuickSwitch = (role: UserRole) => {
    authStore.switchRole(role);
    Alert.alert(
      'Persona Switched',
      `Switched to active role: ${role}. All requests and quotes are now contextualized as this user.`
    );
  };

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'LOGIN') {
        await authStore.login(email.trim());
        Alert.alert('Signed In', `Welcome back, ${authStore.getUser().name}!`);
      } else {
        if (!name.trim()) {
          Alert.alert('Name Required', 'Please enter your name.');
          setSubmitting(false);
          return;
        }
        await authStore.register({
          email: email.trim(),
          phone: phone.trim() || '+1 (555) 000-0000',
          role: selectedRole,
          name: name.trim(),
          businessName: businessName.trim() || undefined,
        });
        Alert.alert('Account Created', `Registered as ${selectedRole}!`);
      }
      router.back();
    } catch {
      Alert.alert('Authentication Error', 'Could not complete login/registration.');
    } finally {
      setSubmitting(false);
    }
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

        {/* Current Active Persona Card */}
        <ThemedView type="backgroundElement" style={styles.activeCard}>
          <ThemedText style={styles.sectionHeading}>ACTIVE IDENTITY</ThemedText>
          <ThemedText style={styles.activeName}>{auth.user.name}</ThemedText>
          <ThemedText style={styles.activeEmail}>{auth.user.email}</ThemedText>
          <View style={styles.roleTag}>
            <ThemedText style={styles.roleTagText}>ROLE: {auth.user.role}</ThemedText>
          </View>
        </ThemedView>

        {/* 1-Click Role Switcher */}
        <View style={styles.switcherSection}>
          <ThemedText style={styles.sectionTitle}>1-Click Persona Switcher</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Test Weyro from different stakeholder perspectives:
          </ThemedText>

          <View style={styles.personasRow}>
            <Pressable
              style={[
                styles.personaBtn,
                auth.user.role === 'CUSTOMER' && styles.personaBtnActive,
              ]}
              onPress={() => handleQuickSwitch('CUSTOMER')}>
              <ThemedText style={styles.personaEmoji}>🚗</ThemedText>
              <ThemedText style={styles.personaLabel}>Customer</ThemedText>
              <ThemedText style={styles.personaSub}>Marcus Vance</ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.personaBtn,
                auth.user.role === 'PROVIDER' && styles.personaBtnActive,
              ]}
              onPress={() => handleQuickSwitch('PROVIDER')}>
              <ThemedText style={styles.personaEmoji}>🔧</ThemedText>
              <ThemedText style={styles.personaLabel}>Parts Dealer</ThemedText>
              <ThemedText style={styles.personaSub}>Apex OEM</ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.personaBtn,
                auth.user.role === 'ADMIN' && styles.personaBtnActive,
              ]}
              onPress={() => handleQuickSwitch('ADMIN')}>
              <ThemedText style={styles.personaEmoji}>🛡️</ThemedText>
              <ThemedText style={styles.personaLabel}>Ops Auditor</ThemedText>
              <ThemedText style={styles.personaSub}>Admin</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Custom Auth Form */}
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

          {mode === 'REGISTER' && (
            <>
              <ThemedText style={styles.inputLabel}>Full Name</ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.text, borderColor: theme.backgroundElement },
                ]}
                placeholder="e.g. Sarah Connor"
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />

              <ThemedText style={styles.inputLabel}>Phone Number</ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.text, borderColor: theme.backgroundElement },
                ]}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
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
                      {r === 'CUSTOMER' ? 'Car Owner' : 'Parts / Mechanic'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {selectedRole === 'PROVIDER' && (
                <>
                  <ThemedText style={styles.inputLabel}>Workshop / Business Name</ThemedText>
                  <TextInput
                    style={[
                      styles.textInput,
                      { color: theme.text, borderColor: theme.backgroundElement },
                    ]}
                    placeholder="e.g. TurboFix Garage & Salvage"
                    placeholderTextColor={theme.textSecondary}
                    value={businessName}
                    onChangeText={setBusinessName}
                  />
                </>
              )}
            </>
          )}

          <ThemedText style={styles.inputLabel}>Email Address</ThemedText>
          <TextInput
            style={[
              styles.textInput,
              { color: theme.text, borderColor: theme.backgroundElement },
            ]}
            placeholder="your.email@example.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.submitBtnText}>
                {mode === 'LOGIN' ? 'Sign In with Email' : 'Register Account'}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
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
  switcherSection: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: Spacing.two,
  },
  personasRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  personaBtn: {
    flex: 1,
    padding: Spacing.two,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  personaBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  personaEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  personaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  personaSub: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
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
