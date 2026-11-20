import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from 'expo-router/react-navigation';

/**
 * Navigation theme — mirrors the active Weyro palette (single-mode dark app;
 * `src/theme/colors.ts` is the source of truth for the StyleSheet layer and
 * `global.css` for the NativeWind layer — keep all three in sync).
 *
 * Both entries use the dark values so any navigator surface React Navigation
 * owns (stack headers, modals, sheets) inherits the premium dark theme.
 *
 * Required by the React Native Reusables setup
 * (reactnativereusables.com/docs/installation/manual#configure-your-styles).
 */
const COLORS = {
  /** graphite — #17191C */
  background: 'hsl(210 11% 7%)',
  /** raised graphite — #1C1F23 */
  card: 'hsl(214 11% 13%)',
  /** titanium 18% — #313437 */
  border: 'hsl(210 7% 18%)',
  /** performance orange — #FF5A1F */
  primary: 'hsl(17 100% 56%)',
  /** titanium — #A7ADB4 */
  text: 'hsl(60 8% 96%)',
  /** functional error — #E06455 */
  notification: 'hsl(7 68% 61%)',
} as const;

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      ...COLORS,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      ...COLORS,
    },
  },
};

export { ThemeProvider };
