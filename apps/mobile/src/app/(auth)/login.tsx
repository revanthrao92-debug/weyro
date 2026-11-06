import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckSquare,
  Square,
  UserRound as UserIcon,
  Wrench,
  Package,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { palette, spacing, radii, typography, displayFamily } from '@/theme';

/**
 * Login — reference screen 1 (premium automotive dark).
 * Brand: orange "V" mark + "weyro" wordmark · headline · role segmented
 * selector · icon'd fields · password visibility eye · remember me ·
 * orange pill Log in → · "or" · Create account · diagonal accents.
 */

const ROLE_OPTIONS: { key: EntryRole; label: string; Icon: typeof UserIcon }[] = [
  { key: 'CUSTOMER', label: 'Customer', Icon: UserIcon },
  { key: 'DEALER', label: 'Dealer', Icon: Package },
  { key: 'MECHANIC', label: 'Mechanic', Icon: Wrench },
];

export type EntryRole = 'CUSTOMER' | 'DEALER' | 'MECHANIC';

/** Hero-brand row: orange V mark + lowercase wordmark (matches mock). */
export function BrandMark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const markSize = size === 'md' ? 24 : 18;
  return (
    <View style={brandStyles.row}>
      <Text style={[brandStyles.mark, { fontSize: markSize }]}>V</Text>
      <Text
        style={[
          brandStyles.word,
          size === 'md' ? { fontSize: 22 } : { fontSize: 16 },
        ]}
      >
        weyro
      </Text>
    </View>
  );
}

const brandStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: {
    fontFamily: displayFamily,
    color: palette.accent,
    fontWeight: '700',
  },
  word: {
    fontFamily: displayFamily,
    color: palette.onHeader,
    letterSpacing: 0.5,
  },
});

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [role, setRole] = useState<EntryRole>('CUSTOMER');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const mounted = useRef(true);


  async function handleLogin() {
    if (!emailOrPhone.trim() || !password) return;
    setLoading(true);
    setErrorNote(null);
    try {
      await login(emailOrPhone.trim(), password);
      // Remember-me: portrait of session persistence (SecureStore already
      // persists tokens unconditionally; the flag can adjust that later).
      if (mounted.current) router.replace('/(app)');
    } catch (err: any) {
      if (!mounted.current) return;
      setErrorNote(err?.message || 'Invalid email/phone or password');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Diagonal accent slashes — brand signature (bottom-left) */}
      <View pointerEvents="none" style={styles.slashA} />
      <View pointerEvents="none" style={styles.slashB} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandMark />

          <Text style={styles.heroTitle}>
            Your Vehicle.{'\n'}
            <Text style={{ color: palette.accent }}>Our</Text> Responsibility.
          </Text>
          <Text style={styles.heroSub}>Find parts. Get expert help.\nKeep moving.</Text>

          {/* Role segmented selector */}
          <View style={styles.roleRow}>
            {ROLE_OPTIONS.map(({ key, label, Icon }) => {
              const selected = role === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setRole(key)}
                  style={[styles.roleChip, selected && styles.roleChipSelected]}
                >
                  <Icon
                    size={16}
                    color={selected ? palette.accent : palette.textMuted}
                    strokeWidth={1.8}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      selected && styles.roleTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Email field — mail icon */}
          <View style={styles.fieldWrap}>
            <Mail size={16} color={palette.textMuted} strokeWidth={1.8} />
            <TextInput
              accessibilityLabel="Email or phone"
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={palette.textMuted}
              value={emailOrPhone}
              onChangeText={(t) => {
                setEmailOrPhone(t);
                setErrorNote(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password field — lock icon + visibility eye */}
          <View style={styles.fieldWrap}>
            <Lock size={16} color={palette.textMuted} strokeWidth={1.8} />
            <TextInput
              accessibilityLabel="Password"
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={palette.textMuted}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setErrorNote(null);
              }}
              secureTextEntry={!showPassword}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={16} color={palette.textMuted} strokeWidth={1.8} />
              ) : (
                <Eye size={16} color={palette.textMuted} strokeWidth={1.8} />
              )}
            </Pressable>
          </View>

          {/* Remember me + forgot password */}
          <View style={styles.rememberRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              onPress={() => setRememberMe((v) => !v)}
              style={styles.rememberLeft}
            >
              {rememberMe ? (
                <CheckSquare size={16} color={palette.accent} strokeWidth={1.8} />
              ) : (
                <Square size={16} color={palette.textMuted} strokeWidth={1.8} />
              )}
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* Error note */}
          {errorNote ? <Text style={styles.errorNote}>{errorNote}</Text> : null}

          {/*The ONE primary CTA */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Log in"
            style={[styles.loginBtn, loading && styles.loginBtnLoading]}
            onPress={() => void handleLogin()}
            disabled={loading || !role || !emailOrPhone.trim() || !password}
          >
            <Text style={styles.loginText}>{loading ? 'Logging in…' : 'Log in'}</Text>
            <ArrowRight size={18} color={palette.onAccent} strokeWidth={2.2} />
          </TouchableOpacity>

          {/* or divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Create account outline */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Create account"
            style={styles.createBtn}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.createBtnText}>Create account</Text>
          </TouchableOpacity>

          <View style={styles.footerLine}>
            <Text style={styles.footerText}>New to Weyro? </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={[styles.link, { marginLeft: 2 }]}>Create account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  slashA: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 260,
    height: 160,
    backgroundColor: palette.accent,
    opacity: 0.08,
    transform: [{ rotate: '-35deg' }],
    borderRadius: 24,
  },
  slashB: {
    position: 'absolute',
    bottom: -120,
    left: -60,
    width: 300,
    height: 140,
    backgroundColor: palette.accent,
    opacity: 0.05,
    transform: [{ rotate: '-35deg' }],
    borderRadius: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg + spacing.sm,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  heroTitle: {
    ...typography.display,
    fontFamily: displayFamily,
    color: palette.onHeader,
    marginTop: spacing.lg,
  },
  heroSub: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 4,
    marginBottom: spacing.lg,
    gap: 4,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
  },
  roleChipSelected: {
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  roleText: {
    ...typography.captionMedium,
    color: palette.textSecondary,
  },
  roleTextSelected: {
    color: palette.accent,
    fontWeight: '600',
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 52,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: palette.textPrimary,
    paddingVertical: 0,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  link: { ...typography.captionMedium, color: palette.accent },
  errorNote: {
    ...typography.caption,
    color: palette.danger,
    marginBottom: spacing.sm,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radii.pill,
    height: 56,
  },
  loginBtnLoading: { opacity: 0.7 },
  loginText: {
    ...typography.bodyMedium,
    color: palette.onAccent,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: palette.border },
  orText: {
    ...typography.caption,
    color: palette.textMuted,
  },
  createBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  createBtnText: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  footerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: { ...typography.caption, color: palette.textMuted },
});
