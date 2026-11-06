import { useRef, useState, useEffect } from 'react';
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
import { Image } from 'expo-image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckSquare,
  Square,
  UserRound,
  Package,
  Wrench,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { palette, spacing, radii, typography, displayFamily } from '@/theme';
import { glass } from '@/theme/glass';
import { PorscheSketch911 } from '@/components/art/PorscheSketch911';

/**
 * Login — reference screen 1, FULL-BLEED layout.
 *
 * The Porsche GT3 RS artwork fills the ENTIRE screen behind everything.
 * Form fields are glass panels floating on top (you see the car through
 * them). Headline sits at the top on the calm part of the image.
 */

export type EntryRole = 'CUSTOMER' | 'DEALER' | 'MECHANIC';

const ROLES: {
  key: EntryRole;
  label: string;
  Icon: typeof UserRound;
}[] = [
  { key: 'CUSTOMER', label: 'Customer', Icon: UserRound },
  { key: 'DEALER', label: 'Dealer', Icon: Package },
  { key: 'MECHANIC', label: 'Mechanic', Icon: Wrench },
];

/** The dark-orange Porsche GT3 RS artwork (full-bleed hero). */
const HERO_CAR =
  'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1400&q=85';

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

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleLogin() {
    if (!emailOrPhone.trim() || !password) return;
    setLoading(true);
    setErrorNote(null);
    try {
      await login(emailOrPhone.trim(), password);
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
      {/* ── FULL-BLEED car artwork behind EVERYTHING ────────────────────── */}
      <Image
        source={{ uri: HERO_CAR }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      {/* deep carbon scrim — keeps top readable + bottom dark for the form */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(3, 4, 5, 0.42)',
        }}
      />

      {/* blueprint sketch top-right (faint) */}
      <View pointerEvents="none" style={styles.blueprint}>
        <PorscheSketch911 opacity={0.1} strokeWidth={2} />
      </View>

      {/* ── Content (all floating on top of the artwork) ────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. brand */}
          <Text style={styles.wordmark}>weyro</Text>

          {/* 2. headline */}
          <Text style={styles.headline}>
            Your Vehicle.
            {'\n'}
            <Text style={{ color: palette.accent }}>Our</Text> Responsibility.
          </Text>
          <Text style={styles.subline}>Find parts. Get expert help. Keep moving.</Text>
          <View style={styles.underlineBar} />

          {/* 3. role selector */}
          <View style={styles.roleRow}>
            {ROLES.map(({ key, label, Icon }) => {
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
                    color={selected ? palette.accent : palette.textSecondary}
                    strokeWidth={1.8}
                  />
                  <Text style={[styles.roleText, selected && styles.roleTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 4. email */}
          <View style={styles.fieldWrap}>
            <Mail size={17} color={palette.textSecondary} strokeWidth={1.8} />
            <TextInput
              accessibilityLabel="Email address"
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

          {/* 5. password */}
          <View style={styles.fieldWrap}>
            <Lock size={17} color={palette.textSecondary} strokeWidth={1.8} />
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
                <EyeOff size={18} color={palette.textSecondary} strokeWidth={1.8} />
              ) : (
                <Eye size={18} color={palette.textSecondary} strokeWidth={1.8} />
              )}
            </Pressable>
          </View>

          {errorNote ? <Text style={styles.errorNote}>{errorNote}</Text> : null}

          {/* 6. remember + forgot */}
          <View style={styles.rememberRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              onPress={() => setRememberMe((v) => !v)}
              style={styles.rememberLeft}
            >
              {rememberMe ? (
                <CheckSquare size={17} color={palette.accent} strokeWidth={1.8} />
              ) : (
                <Square size={17} color={palette.textMuted} strokeWidth={1.8} />
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

          {errorNote ? <Text style={styles.errorNote}>{errorNote}</Text> : null}

          {/* 7. orange login pill */}
          <View style={styles.loginGlow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Log in"
              style={[styles.loginBtn, loading && styles.loginBtnLoading]}
              onPress={() => void handleLogin()}
              disabled={loading || !role || !emailOrPhone.trim() || !password}
            >
              <Text style={styles.loginText}>{loading ? 'Logging in…' : 'Log in'}</Text>
              <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* 8. or divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* 9. create account */}
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
              <Text style={styles.link}>Create account</Text>
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
    backgroundColor: '#08090B',
  },

  blueprint: {
    position: 'absolute',
    top: spacing.sm,
    right: -spacing.xs,
    width: 200,
    height: 90,
    zIndex: 5,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.xxl,
  },

  wordmark: {
    fontFamily: displayFamily,
    color: palette.textPrimary,
    fontSize: 24,
    marginBottom: spacing.lg,
  },

  headline: {
    ...typography.display,
    fontFamily: displayFamily,
    color: palette.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: spacing.sm,
  },
  subline: {
    ...typography.caption,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  underlineBar: {
    width: 96,
    height: 2,
    backgroundColor: palette.accent,
    borderRadius: 1,
    marginTop: spacing.sm,
    marginBottom: 0,
  },

  roleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(25, 28, 32, 0.85)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  roleChipSelected: {
    borderWidth: 1.5,
    borderColor: palette.accent,
    backgroundColor: 'rgba(255, 90, 31, 0.09)',
    borderRadius: radii.md,
  },
  roleText: {
    ...typography.bodyMedium,
    color: palette.textSecondary,
  },
  roleTextSelected: {
    color: palette.accent,
    fontWeight: '600',
  },

  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(20, 22, 24, 0.7)',
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 56,
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

  loginGlow: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 90, 31, 0.5)',
    padding: 2,
    backgroundColor: 'rgba(255, 90, 31, 0.12)',
  },
  loginBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  loginBtnLoading: { opacity: 0.8 },
  loginText: {
    ...typography.bodyMedium,
    fontFamily: displayFamily,
    fontSize: 17,
    color: '#FFFFFF',
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: glass.border },
  orText: { ...typography.caption, color: palette.textMuted },

  createBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    backgroundColor: glass.bg,
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
