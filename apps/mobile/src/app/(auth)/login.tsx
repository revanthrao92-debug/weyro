import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  UserRound,
  Package,
  Wrench,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import {
  palette,
  spacing,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { PressableScale } from '@/components/ui';

/**
 * Login — full-bleed automotive artwork with a rigid work-order form sheet.
 * No role selector and no decorative glow: the form is the object.
 */

const HERO_CAR =
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1400&q=85';

type EntryRole = 'CUSTOMER' | 'DEALER' | 'MECHANIC';

const ROLES: { key: EntryRole; label: string; Icon: typeof UserRound }[] = [
  { key: 'CUSTOMER', label: 'Customer', Icon: UserRound },
  { key: 'DEALER', label: 'Dealer', Icon: Package },
  { key: 'MECHANIC', label: 'Mechanic', Icon: Wrench },
];

const SERVICE_PROVIDER_TYPES = [
  'MECHANIC',
  'GARAGE',
  'AUTHORIZED_CENTER',
  'TOWING',
  'ROADSIDE',
  'DRIVER',
];

function accountInterface(account: {
  role?: string | null;
  providerProfile?: { providerType?: string | null } | null;
}): EntryRole | 'ADMIN' {
  if (account.role === 'ADMIN') return 'ADMIN';
  const providerType = account.providerProfile?.providerType;
  if (providerType === 'PARTS_DEALER') return 'DEALER';
  if (providerType && SERVICE_PROVIDER_TYPES.includes(providerType)) {
    return 'MECHANIC';
  }
  return 'CUSTOMER';
}

function roleMatches(account: any, role: EntryRole) {
  const actual = accountInterface(account);
  return actual === 'ADMIN' || actual === role;
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [role, setRole] = useState<EntryRole>('CUSTOMER');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const canSubmit =
    emailOrPhone.trim().length > 0 && password.length > 0 && !loading;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    setErrorNote(null);
    try {
      const account = await login(emailOrPhone.trim(), password);
      if (!roleMatches(account, role)) {
        const actual = accountInterface(account);
        const actualLabel =
          actual === 'CUSTOMER'
            ? 'Customer'
            : actual === 'DEALER'
              ? 'Dealer'
              : actual === 'MECHANIC'
                ? 'Mechanic'
                : 'Admin';
        await logout();
        if (mounted.current) {
          setErrorNote(
            `This account signs in as ${actualLabel}. Select ${actualLabel} and try again.`,
          );
        }
        return;
      }
      if (mounted.current) {
        router.replace('/(app)');
      }
    } catch (err: any) {
      if (mounted.current) {
        setErrorNote(err?.message || 'Invalid email/phone or password');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: HERO_CAR }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.wordmark}>weyro</Text>

          <Text style={styles.headline}>
            Your vehicle.{'\n'}
            <Text style={styles.headlineAccent}>Our</Text> responsibility.
          </Text>
          <Text style={styles.subline}>
            Parts, repair and roadside help from verified providers.
          </Text>

          <View style={styles.form}>
            <View style={styles.formHead}>
              <Text style={styles.formTitle}>Log in</Text>
              <Text style={styles.formMeta}>Member access</Text>
            </View>

            <View style={styles.roleSection}>
              <Text style={styles.label}>Sign in as</Text>
              <View style={styles.roleRow}>
                {ROLES.map(({ key, label, Icon }) => {
                  const selected = role === key;
                  return (
                    <PressableScale
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Sign in as ${label}`}
                      onPress={() => {
                        setRole(key);
                        setErrorNote(null);
                      }}
                      scaleTo={0.98}
                      style={[styles.roleTab, selected && styles.roleTabSelected]}
                    >
                      <Icon
                        size={15}
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
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email or phone</Text>
              <View style={styles.inputShell}>
                <Mail size={16} color={palette.textMuted} strokeWidth={1.8} />
                <TextInput
                  accessibilityLabel="Email address or phone"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={palette.textMuted}
                  value={emailOrPhone}
                  onChangeText={(value) => {
                    setEmailOrPhone(value);
                    setErrorNote(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputShell}>
                <Lock size={16} color={palette.textMuted} strokeWidth={1.8} />
                <TextInput
                  accessibilityLabel="Password"
                  style={styles.input}
                  placeholder="Your password"
                  placeholderTextColor={palette.textMuted}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrorNote(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={() => void handleLogin()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={8}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff
                      size={17}
                      color={palette.textSecondary}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Eye
                      size={17}
                      color={palette.textSecondary}
                      strokeWidth={1.8}
                    />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.forgotRow}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Forgot password"
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            </View>

            {errorNote ? (
              <Text
                style={styles.errorNote}
                accessibilityLiveRegion="polite"
              >
                {errorNote}
              </Text>
            ) : null}

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Log in"
              accessibilityState={{ disabled: !canSubmit, busy: loading }}
              style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}
              onPress={() => void handleLogin()}
              disabled={!canSubmit}
              scaleTo={0.99}
            >
              <Text style={styles.loginText}>
                {loading ? 'Logging in…' : 'Log in'}
              </Text>
              <ArrowRight
                size={18}
                color={palette.canvas}
                strokeWidth={2}
              />
            </PressableScale>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New to Weyro?</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Create account"
                onPress={() => router.push('/(auth)/register')}
                hitSlop={8}
              >
                <Text style={styles.link}>Create account</Text>
              </Pressable>
            </View>
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
  flex: { flex: 1 },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 18, 20, 0.58)',
  },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    backgroundColor: 'rgba(16, 18, 20, 0.82)',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  wordmark: {
    fontFamily: displayFamily,
    color: palette.textPrimary,
    fontSize: 24,
    marginBottom: spacing.xl,
  },
  headline: {
    fontFamily: displayFamily,
    color: palette.textPrimary,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  headlineAccent: { color: palette.accent },
  subline: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  form: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  formTitle: {
    fontFamily: displayFamily,
    fontSize: 18,
    color: palette.textPrimary,
  },
  formMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: palette.textMuted,
  },
  field: { marginTop: spacing.md },
  label: {
    ...typography.label,
    color: palette.textSecondary,
    marginBottom: 6,
  },
  roleSection: { marginTop: spacing.md },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
  },
  roleTabSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  roleText: { ...typography.label, color: palette.textSecondary },
  roleTextSelected: { color: palette.accent },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: palette.textPrimary,
    paddingVertical: 0,
  },
  eyeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  link: { ...typography.captionMedium, color: palette.accent },
  errorNote: {
    ...typography.caption,
    color: palette.danger,
    marginBottom: spacing.md,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: 4,
    backgroundColor: palette.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.textPrimary,
    marginTop: spacing.xs,
  },
  loginBtnDisabled: { opacity: 0.45 },
  loginText: {
    ...typography.bodyMedium,
    color: palette.canvas,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  footerText: { ...typography.caption, color: palette.textMuted },
});
