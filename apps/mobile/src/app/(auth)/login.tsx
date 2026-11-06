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
import { glass } from '@/theme/glass';
import { displayFamily, palette, radii, spacing, typography } from '@/theme';
import { PorscheSketch911 } from '@/components/art/PorscheSketch911';

/**
 * Login — reference screen 1 EXACT layout.
 *
 * Layer order (top → bottom):
 *   1. "weyro" wordmark (no "V" mark, lowercase, plain white)
 *   2. Headline: "Your Vehicle." / "Our Responsibility." (Our in orange)
 *      with "Find parts. Get expert help. Keep moving." + orange underline
 *   3. Big orange-glow Porsche GT3 artwork filling the mid-band
 *   4. Role segmented selector (Customer / Dealer / Mechanic) with icons
 *   5. Email + Password icon'd inputs (password-visibility eye)
 *   6. Remember me (checked orange) + Forgot password?
 *   7. Full-width orange "Log in →" pill with strong orange edge-glow
 *   8. "or" divider
 *   9. Create account pill (dark, glassed)
 *   10. "New to Weyro? Create account" footer link
 *  Extra: blueprint sketch top-right, orange diagonal circuit accents at
 *  bottom-left/right (subtle tire-tread + glowing curves)
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

/** Porsche artwork — dark orange GT3 hero (~1494976388531 = ripe Porsche GT3 shot) */
const HERO_CAR =
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd6?auto=format&fit=crop&w=900&q=85';

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
      {/* ── Decorative background layers ────────────────────────────────── */}
      {/* top-right blueprint sketch */}
      <View pointerEvents="none" style={styles.blueprint}>
        <PorscheSketch911 opacity={0.09} strokeWidth={2} />
      </View>

      {/* bottom-left tire-tread block */}
      <View pointerEvents="none" style={styles.treadBlock} />
      {/* bottom-right circuit diagonal */}
      <View pointerEvents="none" style={styles.circuitSlashA} />
      <View pointerEvents="none" style={styles.circuitSlashB} />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. brand mark */}
          <Text style={styles.wordmark}>weyro</Text>

          {/* 2. headline */}
          <Text style={styles.headline}>
            Your Vehicle.{'\n'}
            <Text style={{ color: palette.accent }}>Our</Text> Responsibility.
          </Text>
          <Text style={styles.subline}>Find parts. Get expert help. Keep moving.</Text>
          <View style={styles.underlineBar} />

          {/* 3. car artwork */}
          <View style={styles.carWrap}>
            <Image source={{ uri: HERO_CAR }} style={styles.carImg} contentFit="cover" />
            {/* orange rim glow */}
            <View style={styles.carGlowEdgeTop} />
            <View style={styles.carGlowEdgeBottom} />
            {/* carbon shade for readability */}
            <View style={styles.carShade} />
          </View>

          {/* 4. role selector */}
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

          {/* 5. email */}
          <View style={styles.fieldWrap}>
            <Mail size={17} color={palette.textMuted} strokeWidth={1.8} />
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

          {/* password */}
          <View style={styles.fieldWrap}>
            <Lock size={17} color={palette.textMuted} strokeWidth={1.8} />
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
                <EyeOff size={18} color={palette.textMuted} strokeWidth={1.8} />
              ) : (
                <Eye size={18} color={palette.textMuted} strokeWidth={1.8} />
              )}
            </Pressable>
          </View>

          {/* remember + forgot */}
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

          {/* 7. Login pill with orange glow */}
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

          {/* 9. Create account */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Create account"
            style={styles.createBtn}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.createBtnText}>Create account</Text>
          </TouchableOpacity>

          {/* footer line */}
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
    backgroundColor: '#08090B', // deepest carbon (matches the mock edge color)
    overflow: 'hidden',
  },

  // — decorative overlays —
  blueprint: {
    position: 'absolute',
    top: spacing.sm,
    right: -spacing.sm,
    width: 200,
    height: 90,
  },
  treadBlock: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 400,
    height: 240,
    backgroundColor: 'rgba(255, 90, 31, 0.04)',
    borderTopLeftRadius: radii.lg,
    transform: [{ rotate: '-20deg' }],
  },
  circuitSlashA: {
    position: 'absolute',
    bottom: 140,
    right: -100,
    width: 340,
    height: 2,
    backgroundColor: 'rgba(255, 90, 31, 0.35)',
    transform: [{ rotate: '-30deg' }],
  },
  circuitSlashB: {
    position: 'absolute',
    bottom: 100,
    right: -80,
    width: 220,
    height: 1,
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    transform: [{ rotate: '-30deg' }],
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.xxl,
  },

  // — brand —
  wordmark: {
    ...typography.title,
    fontFamily: displayFamily,
    color: palette.textPrimary,
    fontSize: 24,
    marginBottom: spacing.lg,
    alignContent: 'flex-start',
  },

  // — headline block —
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

  // — car artwork —
  carWrap: {
    height: 220,
    marginTop: spacing.lg,
    marginBottom: spacing.lg + spacing.xs,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  carImg: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  carGlowEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 90, 31, 0.4)',
  },
  carGlowEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 90, 31, 0.35)',
  },
  carShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3, 4, 5, 0.25)',
  },

  // — role selector —
  roleRow: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
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

  // — inputs (glass) —
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: glass.bgInput,
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

  // — remember row —
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

  // — Log in pill (orange-glow) —
  loginGlow: {
    borderRadius: radii.pill,
    // outer soft glow via nested layer
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

  // — or divider —
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: glass.border },
  orText: { ...typography.caption, color: palette.textMuted },

  // — create account —
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
