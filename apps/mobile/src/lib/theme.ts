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
  /** canvas — #0B0F12 */
  background: 'hsl(206 24% 6%)',
  /** surface — #1D272F */
  card: 'hsl(206 22% 17%)',
  /** border — #2B3842 */
  border: 'hsl(206 21% 21%)',
  /** accent — #E53935 */
  primary: 'hsl(1 77% 55%)',
  /** textPrimary — #F5F7F9 */
  text: 'hsl(204 22% 95%)',
  /** danger — #E53935 */
  notification: 'hsl(1 77% 55%)',
} as const;

const DARK_TOKENS = {
  background: COLORS.background,
  foreground: COLORS.text,
  card: COLORS.card,
  cardForeground: COLORS.text,
  popover: COLORS.card,
  popoverForeground: COLORS.text,
  primary: COLORS.primary,
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(209 9% 50%)',
  secondaryForeground: COLORS.text,
  muted: 'hsl(209 9% 50%)',
  mutedForeground: 'hsl(209 14% 70%)',
  accent: 'hsl(209 9% 50%)',
  accentForeground: COLORS.text,
  destructive: COLORS.notification,
  destructiveForeground: 'hsl(0 0% 100%)',
  border: COLORS.border,
  input: COLORS.border,
  ring: COLORS.primary,
  radius: '0.875rem',
} as const;

export const THEME = {
  light: DARK_TOKENS, // single-mode app — dark values in both slots
  dark: DARK_TOKENS,
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
