import { Appearance, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Appearance choice (Profile -> Appearance). Read synchronously at startup so
 * every StyleSheet is created with the right colours; changing it restarts
 * the app (screens build their styles once, at load).
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorSchemeName = 'light' | 'dark';

const KEY = 'weyro_theme';

export function readThemePreference(): ThemePreference {
  try {
    const value =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** "System" follows the phone; anything unknown stays dark (the original look). */
export function resolveColorScheme(
  preference: ThemePreference,
  system: string | null | undefined = Appearance.getColorScheme(),
): ColorSchemeName {
  if (preference !== 'system') return preference;
  return system === 'light' ? 'light' : 'dark';
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, preference);
    return;
  }
  await SecureStore.setItemAsync(KEY, preference);
}
