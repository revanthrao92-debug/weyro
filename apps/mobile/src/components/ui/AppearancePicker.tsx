import { Platform, StyleSheet, Text, View } from 'react-native';
import { reloadAppAsync } from 'expo';
import { Chip } from './Chip';
import { palette, spacing, typography, themePreference, saveThemePreference, type ThemePreference } from '@/theme';

const APPEARANCE: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Save the choice and restart: screens build their colours once, at load. */
async function chooseAppearance(next: ThemePreference) {
  if (next === themePreference) return;
  await saveThemePreference(next);
  if (Platform.OS === 'web') globalThis.location?.reload();
  else await reloadAppAsync();
}

/** Profile → Appearance: Light or Dark. Same on every role's profile. */
export function AppearancePicker() {
  return (
    <View style={styles.appearance}>
      <Text style={styles.label}>Appearance</Text>
      <View style={styles.chips}>
        {APPEARANCE.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={themePreference === option.value}
            accessibilityLabel={`Appearance: ${option.label}`}
            onPress={() => void chooseAppearance(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appearance: { paddingVertical: spacing.sm, gap: spacing.sm },
  label: { ...typography.bodyMedium, color: palette.textPrimary },
  chips: { flexDirection: 'row', gap: spacing.sm },
});
