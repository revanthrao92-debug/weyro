import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from 'expo-router/react-navigation';

/**
 * Navigation theme — mirrors the active Weyro palette (single-mode light app;
 * `src/theme/colors.ts` is the source of truth for the StyleSheet layer and
 * `global.css` for the NativeWind layer — keep all three in sync).
 *
 * Both entries use the light values so any navigator surface React Navigation
 * owns (stack headers, modals, sheets) inherits the premium light theme.
 *
 * Required by the React Native Reusables setup
 * (reactnativereusables.com/docs/installation/manual#configure-your-styles).
 */
const COLORS = {
  /** canvas — #F5F6F7 */
  background: 'hsl(210 11% 96%)',
  /** surface — #FFFFFF */
  card: 'hsl(0 0% 100%)',
  /** border — #E1E4E8 */
  border: 'hsl(214 13% 90%)',
  /** accent — #1F6F6B */
  primary: 'hsl(177 56% 28%)',
  /** textPrimary — #171A1D */
  text: 'hsl(210 12% 10%)',
  /** danger — #A32C24 */
  notification: 'hsl(4 64% 39%)',
} as const;

const LIGHT_TOKENS = {
  background: COLORS.background,
  foreground: COLORS.text,
  card: COLORS.card,
  cardForeground: COLORS.text,
  popover: COLORS.card,
  popoverForeground: COLORS.text,
  primary: COLORS.primary,
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(210 12% 93%)',
  secondaryForeground: COLORS.text,
  muted: 'hsl(210 12% 93%)',
  mutedForeground: 'hsl(211 12% 34%)',
  accent: 'hsl(210 12% 93%)',
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
