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
  /** canvas — #F5F8FA */
  background: 'hsl(204 33% 97%)',
  /** surface — #FFFFFF */
  card: 'hsl(0 0% 100%)',
  /** border — #E3EAEE */
  border: 'hsl(202 24% 91%)',
  /** teal — #017365 (links/active accent) */
  primary: 'hsl(173 98% 23%)',
  /** textPrimary — #0B1F2A */
  text: 'hsl(201 58% 10%)',
  /** danger — #D64545 */
  notification: 'hsl(0 64% 55%)',
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
