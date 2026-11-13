import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Input, Chip, BackButton, Button } from '@/components/ui';
import { palette, spacing, radii, typography, displayFamily } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RoleOption = 'CUSTOMER' | 'PROVIDER' | 'BOTH';

const PROVIDER_TYPES = [
  { value: 'MECHANIC', label: 'Mechanic' },
  { value: 'GARAGE', label: 'Garage' },
  { value: 'PARTS_DEALER', label: 'Parts dealer' },
  { value: 'TOWING', label: 'Towing' },
  { value: 'ROADSIDE', label: 'Roadside' },
  { value: 'DRIVER', label: 'Driver' },
] as const;

const TOWING_TYPES = [
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'HOOK_AND_CHAIN', label: 'Hook & chain' },
  { value: 'MOTORCYCLE', label: 'Motorcycle' },
  { value: 'ANY', label: 'Any' },
] as const;

/** Role carried over from the Login screen's role buttons (Customer/Dealer/Mechanic). */
function roleFromParams(
  roleKey?: string | string[],
  apiRole?: string | string[]
): RoleOption {
  const key = Array.isArray(roleKey) ? roleKey[0] : roleKey;
  const api = Array.isArray(apiRole) ? apiRole[0] : apiRole;
  if (api === 'PROVIDER') return 'PROVIDER';
  if (key === 'DEALER' || key === 'MECHANIC' || key === 'OTHER') {
    return 'PROVIDER';
  }
  return 'CUSTOMER';
}

export default function RegisterScreen() {
  const { roleKey, apiRole } = useLocalSearchParams<{
    roleKey?: string;
    apiRole?: string;
  }>();
  const [form, setForm] = useState<{
    email: string;
    phone: string;
    password: string;
    role: RoleOption;
    firstName: string;
    lastName: string;
    businessName: string;
    providerType: string;
    description: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    towingVehicleTypes: string[];
  }>({
    email: '',
    phone: '',
    password: '',
    role: roleFromParams(roleKey, apiRole),
    firstName: '',
    lastName: '',
    businessName: '',
    providerType:
      (Array.isArray(roleKey) ? roleKey[0] : roleKey) === 'DEALER'
        ? 'PARTS_DEALER'
        : 'MECHANIC',
    description: '',
    address: '',
    latitude: null,
    longitude: null,
    towingVehicleTypes: [],
  });
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function captureCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location needed',
          'Allow location access so customers can find your business.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      let address = form.address;
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (place) {
          address = [
            place.name,
            place.street,
            place.district ?? place.city,
            place.region,
            place.postalCode,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch {
        // Keep the typed address; coordinates are still valid.
      }
      setForm((current) => ({
        ...current,
        latitude,
        longitude,
        address: address || current.address,
      }));
    } catch {
      Alert.alert('Could not get location', 'Enter your address and try again.');
    } finally {
      setLocating(false);
    }
  }

  async function handleRegister() {
    const { email, phone, password, role, firstName, lastName, businessName } = form;
    if (!email || !phone || !password || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters and include a letter and a number.',
      );
      return;
    }
    const isProvider = role === 'PROVIDER' || role === 'BOTH';
    if (isProvider) {
      if (!businessName.trim() || !form.address.trim()) {
        Alert.alert(
          'Business details needed',
          'Add your business name and address so customers can find you.',
        );
        return;
      }
      if (
        form.latitude === null ||
        form.longitude === null
      ) {
        Alert.alert(
          'Location needed',
          'Use your current location so Weyro can match nearby work.',
        );
        return;
      }
      if (
        form.providerType === 'TOWING' &&
        form.towingVehicleTypes.length === 0
      ) {
        Alert.alert(
          'Towing equipment needed',
          'Select at least one towing vehicle type.',
        );
        return;
      }
    }
    setLoading(true);
    try {
      await register({
        email,
        phone,
        password,
        role,
        firstName,
        lastName,
        businessName: businessName || undefined,
        providerType: isProvider ? form.providerType : undefined,
        description: isProvider
          ? form.description.trim() || undefined
          : undefined,
        address: isProvider ? form.address.trim() : undefined,
        latitude: isProvider ? form.latitude ?? undefined : undefined,
        longitude: isProvider ? form.longitude ?? undefined : undefined,
        towingVehicleTypes:
          isProvider && form.providerType === 'TOWING'
            ? form.towingVehicleTypes
            : undefined,
      });
      router.replace('/(app)');
    } catch (error: any) {
      Alert.alert('Registration failed', error.message || 'Unable to register');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>New account</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Join Weyro to book repairs and order parts
          </Text>
        </View>

        <View>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(t) => setForm({ ...form, email: t })}
            autoCapitalize="none"
            autoCompleteType="email"
          />
          <Input
            label="Phone"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
            keyboardType="phone-pad"
            autoCompleteType="tel"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={form.password}
            onChangeText={(t) => setForm({ ...form, password: t })}
            secureTextEntry
            autoCompleteType="new-password"
          />
          <Input
            label="First name"
            placeholder="First name"
            value={form.firstName}
            onChangeText={(t) => setForm({ ...form, firstName: t })}
          />
          <Input
            label="Last name"
            placeholder="Last name"
            value={form.lastName}
            onChangeText={(t) => setForm({ ...form, lastName: t })}
          />

          <Text style={styles.label}>Role</Text>
          <View style={styles.roleSelector}>
            {(['CUSTOMER', 'PROVIDER', 'BOTH'] as RoleOption[]).map((r) => (
              <View key={r} style={styles.roleChip}>
                <Chip
                  label={r === 'CUSTOMER' ? 'Customer' : r === 'PROVIDER' ? 'Provider' : 'Both'}
                  selected={form.role === r}
                  onPress={() => setForm({ ...form, role: r })}
                />
              </View>
            ))}
          </View>

          {form.role !== 'CUSTOMER' && (
            <>
              <Input
                label="Business name"
                placeholder="e.g. Sharma Motors"
                value={form.businessName}
                onChangeText={(t) => setForm({ ...form, businessName: t })}
              />

              <Text style={styles.label}>Provider type</Text>
              <View style={styles.roleSelector}>
                {PROVIDER_TYPES.map((type) => (
                  <View key={type.value} style={styles.roleChip}>
                    <Chip
                      label={type.label}
                      selected={form.providerType === type.value}
                      onPress={() =>
                        setForm({ ...form, providerType: type.value })
                      }
                    />
                  </View>
                ))}
              </View>

              {form.providerType === 'TOWING' ? (
                <>
                  <Text style={styles.label}>Towing equipment</Text>
                  <View style={styles.roleSelector}>
                    {TOWING_TYPES.map((type) => {
                      const selected = form.towingVehicleTypes.includes(
                        type.value,
                      );
                      return (
                        <View key={type.value} style={styles.roleChip}>
                          <Chip
                            label={type.label}
                            selected={selected}
                            onPress={() =>
                              setForm({
                                ...form,
                                towingVehicleTypes: selected
                                  ? form.towingVehicleTypes.filter(
                                      (value) => value !== type.value,
                                    )
                                  : [...form.towingVehicleTypes, type.value],
                              })
                            }
                          />
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Input
                label="Business address"
                placeholder="Street, area, city"
                value={form.address}
                onChangeText={(t) => setForm({ ...form, address: t })}
                multiline
              />
              <Button
                title={
                  locating
                    ? 'Getting location…'
                    : form.latitude !== null
                      ? 'Location set — update'
                      : 'Use my current location'
                }
                variant="secondary"
                onPress={() => void captureCurrentLocation()}
                loading={locating}
                disabled={locating}
              />
              <Text style={styles.locationHelp}>
                Customers only see your approximate distance, never your exact
                pin.
              </Text>

              <Input
                label="About your business"
                placeholder="Services, specialties, years of experience"
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
                multiline
              />
            </>
          )}
        </View>

        <Pressable
          onPress={() => void handleRegister()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Sign up"
          style={[styles.signupBtn, loading && styles.signupBtnLoading]}
        >
          <Text style={styles.signupText}>
            {loading ? 'Creating account…' : 'Sign up'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
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
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  topBarSpacer: { width: 44 },
  locationHelp: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary, marginTop: spacing.sm },
  label: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  signupBtn: {
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  signupBtnPressed: { backgroundColor: palette.accentPressed },
  signupBtnLoading: { opacity: 0.7 },
  signupText: {
    fontFamily: displayFamily,
    fontSize: 17,
    color: palette.onAccent,
  },
  roleSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChip: { flex: 1, minWidth: 90 },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerText: { ...typography.caption, color: palette.textSecondary },
  link: { ...typography.captionMedium, color: palette.accent },
});
