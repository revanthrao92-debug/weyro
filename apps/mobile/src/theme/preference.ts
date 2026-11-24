import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Appearance choice (Profile -> Appearance: Light / Dark). Read synchronously
 * at startup so every StyleSheet is created with the right colours; changing
 * it restarts the app (screens build their styles once, at load).
 */
export type ThemePreference = 'light' | 'dark';
export type ColorSchemeName = ThemePreference;

const KEY = 'weyro_theme';

/** Saved choice, or dark (the original look) when nothing valid is saved, e.g. an old "system". */
export function readThemePreference(): ThemePreference {
  try {
    const value =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return parseThemePreference(value);
  } catch {
    return 'dark';
  }
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === 'light' ? 'light' : 'dark';
}

export function resolveColorScheme(preference: ThemePreference): ColorSchemeName {
  return preference;
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, preference);
    return;
  }
  await SecureStore.setItemAsync(KEY, preference);
}
