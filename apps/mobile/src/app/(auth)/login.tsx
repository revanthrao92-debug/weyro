import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Input, Button } from '@/components/ui';
import { palette, spacing, typography, radii } from '@/theme';
import { UserRole } from '@weyro/api-contracts';

/**
 * Welcome / Login — first screen a user sees.
 *
 * Matches the approved reference design:
 * - Dark navy hero with logo + "More than repairs. Total vehicle care."
 * - White sheet with role selection (Customer / Dealer / Mechanic) + login form
 *
 * Role note: the backend knows CUSTOMER / PROVIDER / BOTH / ADMIN.
 * "Dealer" and "Mechanic" both sign in as PROVIDER — `providerKind` is a
 * UI-level preference used in later checkpoints to pick the interface,
 * and is passed to the register screen so new accounts register correctly.
 */

export type EntryRole = 'CUSTOMER' | 'DEALER' | 'MECHANIC';

const ROLE_OPTIONS: { key: EntryRole; label: string }[] = [
  { key: 'CUSTOMER', label: 'Customer' },
  { key: 'DEALER', label: 'Dealer' },
  { key: 'MECHANIC', label: 'Mechanic' },
];

export default function LoginScreen() {
  const [role, setRole] = useState<EntryRole | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  function resolveApiRole(): UserRole {
    return role === 'CUSTOMER' ? 'CUSTOMER' : 'PROVIDER';
  }

  async function handleLogin() {
    if (!role) return; // role chips only enable submit — see styles below
    if (!emailOrPhone || !password) return;
    setLoading(true);
    try {
      await login(emailOrPhone, password);
      router.replace('/(app)');
    } catch (error: any) {
      setPassword('');
      setErrorNote(error?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Dark hero — reference photo bottom-right frame */}
      <View style={styles.hero}>
        {/* Night-car photography behind the chrome, deep overlay */}
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd6?auto=format&fit=crop&w=1200&q=80' }}
          style={[styles.heroPhoto, { resizeMode: 'cover' }]}
        />
        <View style={styles.heroShade} />
        <View style={styles.heroShadeBottom} />
        <View style={styles.logoRow}>
          <Image
            source={require('../../../assets/images/weyro-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>WEYRO</Text>
        </View>
        <Text style={styles.heroTitle}>More than repairs.</Text>
        <Text style={styles.heroTitleAccent}>Total vehicle care.</Text>
        <Text style={styles.heroCaption}>
          Repairs · Spare Parts · Towing · Home Mechanic
        </Text>
      </View>

      {/* White sheet: role buttons + login form */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.whoTitle}>I am a…</Text>
          <View style={styles.roleRow}>
            {ROLE_OPTIONS.map(({ key, label }) => {
              const selected = role === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setRole(key)}
                  style={[styles.roleChip, selected && styles.roleChipSelected]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      selected && styles.roleChipTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={role ? styles.formArea : styles.formAreaMuted}>
            <Input
              label="Email or phone"
              placeholder="you@example.com"
              value={emailOrPhone}
              onChangeText={(t) => {
                setEmailOrPhone(t);
                setErrorNote(null);
              }}
              autoCapitalize="none"
              editable={!!role}
            />
            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setErrorNote(null);
              }}
              secureTextEntry
              editable={!!role}
            />

            {errorNote ? <Text style={styles.errorNote}>{errorNote}</Text> : null}

            {/* The ONE primary CTA on this screen */}
            <Button
              title="Log in"
              onPress={handleLogin}
              loading={loading}
              disabled={!role || !emailOrPhone || !password}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                New to Weyro?{' '}
                <Text
                  style={styles.link}
                  onPress={() =>
                    router.push({
                      // pass the chosen role into registration
                      pathname: '/(auth)/register',
                      params: {
                        roleKey: role ?? 'CUSTOMER',
                        apiRole: resolveApiRole(),
                      },
                    })
                  }
                  accessibilityRole="link"
                  accessibilityLabel="Register"
                >
                  Create account
                </Text>
              </Text>
              <TouchableOpacity
                disabled={!role}
                onPress={() => router.push('/(auth)/forgot-password')}
                accessibilityRole="link"
                accessibilityLabel="Forgot password"
              >
                <Text style={[styles.link, !role && styles.linkMuted]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.header },

  // ---- Hero (dark chrome) ----
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.xl,
    paddingBottom: spacing.xl,
    height: 300,
    justifyContent: 'flex-start',
  },
  heroPhoto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3, 18, 23, 0.66)' },
  heroShadeBottom: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3, 25, 35, 0.35)' },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  logo: { width: 34, height: 34 },
  logoText: {
    ...typography.heading,
    color: palette.onHeader,
    letterSpacing: 2,
  },
  heroTitle: { ...typography.display, color: palette.onHeader },
  heroTitleAccent: { ...typography.display, color: palette.onHeader },
  heroCaption: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: spacing.sm,
  },

  // ---- White sheet ----
  sheetWrap: { flex: 1 },
  sheetContent: {
    flexGrow: 1,
    backgroundColor: palette.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
  },

  // ---- Role selector ----
  whoTitle: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  roleChipSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  roleChipText: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  roleChipTextSelected: {
    color: palette.onAccent,
  },

  // ---- Form (progressive reveal once a role is chosen) ----
  formArea: {},
  formAreaMuted: { opacity: 0.55 },
  errorNote: {
    ...typography.caption,
    color: palette.danger,
    marginBottom: spacing.sm,
  },
  footer: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footerText: { ...typography.caption, color: palette.textSecondary },
  link: { ...typography.captionMedium, color: palette.accent },
  linkMuted: { opacity: 0.5 },
});
