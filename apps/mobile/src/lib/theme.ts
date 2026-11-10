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

const LIGHT_TOKENS = {
  // Both themes resolve dark: Weyro ships single-mode dark (three-colour identity).
  background: COLORS.background,
  foreground: COLORS.text,
  card: COLORS.card,
  cardForeground: COLORS.text,
  popover: COLORS.card,
  popoverForeground: COLORS.text,
  primary: COLORS.primary,
  primaryForeground: 'hsl(210 11% 7%)',
  secondary: 'hsl(216 10% 10%)',
  secondaryForeground: COLORS.text,
  muted: 'hsl(216 10% 10%)',
  mutedForeground: 'hsl(212 5% 52%)',
  accent: 'hsl(216 10% 10%)',
  accentForeground: COLORS.text,
  destructive: COLORS.notification,
  destructiveForeground: 'hsl(210 11% 7%)',
  border: COLORS.border,
  input: COLORS.border,
  ring: COLORS.primary,
  radius: '0.875rem',
} as const;

export const THEME = {
  light: LIGHT_TOKENS,
  dark: LIGHT_TOKENS, // single-mode app — a real dark theme would live here
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
