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
  /** canvas — #080B0E */
  background: 'hsl(195 29% 5%)', /* #080B0E */
  /** surface — #171D23 */
  card: 'hsl(206 16% 11%)', /* #171D23 */
  /** border — #303941 */
  border: 'hsl(204 14% 22%)', /* #303941 */
  /** accent — #F47721 (links/active) */
  primary: 'hsl(25 89% 54%)', /* #F47721 */
  /** textPrimary — #F5F6F7 */
  text: 'hsl(200 20% 96%)', /* #F5F6F7 */
  /** danger — #E06455 */
  notification: 'hsl(4 66% 61%)', /* #E06455 */
} as const;

const LIGHT_TOKENS = {
  // Both themes resolve dark: Weyro ships single-mode dark (Carbon identity).
  background: COLORS.background,
  foreground: COLORS.text,
  card: COLORS.card,
  cardForeground: COLORS.text,
  popover: COLORS.card,
  popoverForeground: COLORS.text,
  primary: COLORS.primary,
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(200 27% 96%)',
  secondaryForeground: COLORS.text,
  muted: 'hsl(200 27% 96%)',
  mutedForeground: 'hsl(202 15% 39%)',
  accent: 'hsl(200 27% 96%)',
  accentForeground: COLORS.text,
  destructive: COLORS.notification,
  destructiveForeground: 'hsl(0 0% 100%)',
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
