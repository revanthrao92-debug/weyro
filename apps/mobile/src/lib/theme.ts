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
 * owns (stack headers, modals, sheets) inherits the premium dark theme
 * instead of falling back to its light default.
 *
 * Required by the React Native Reusables setup
 * (reactnativereusables.com/docs/installation/manual#configure-your-styles).
 */
const COLORS = {
  /** canvas — #0D1013 */
  background: 'hsl(210 19% 6%)',
  /** surface — #14181C */
  card: 'hsl(210 17% 9%)',
  /** border — #252B31 */
  border: 'hsl(210 14% 17%)',
  /** accent — #2F9E95 */
  primary: 'hsl(175 54% 40%)',
  /** textPrimary — #F1F4F6 */
  text: 'hsl(204 22% 95%)',
  /** danger — #A6352C */
  notification: 'hsl(4 58% 41%)',
} as const;

export const THEME = {
  light: {
    background: COLORS.background,
    foreground: COLORS.text,
    card: COLORS.card,
    cardForeground: COLORS.text,
    popover: COLORS.card,
    popoverForeground: COLORS.text,
    primary: COLORS.primary,
    primaryForeground: 'hsl(168 42% 5%)',
    secondary: 'hsl(213 17% 13%)',
    secondaryForeground: COLORS.text,
    muted: 'hsl(213 17% 13%)',
    mutedForeground: 'hsl(208 10% 71%)',
    accent: 'hsl(213 17% 13%)',
    accentForeground: COLORS.text,
    destructive: COLORS.notification,
    destructiveForeground: 'hsl(0 0% 100%)',
    border: COLORS.border,
    input: COLORS.border,
    ring: COLORS.primary,
    radius: '0.875rem',
  },
  dark: {
    background: COLORS.background,
    foreground: COLORS.text,
    card: COLORS.card,
    cardForeground: COLORS.text,
    popover: COLORS.card,
    popoverForeground: COLORS.text,
    primary: COLORS.primary,
    primaryForeground: 'hsl(168 42% 5%)',
    secondary: 'hsl(213 17% 13%)',
    secondaryForeground: COLORS.text,
    muted: 'hsl(213 17% 13%)',
    mutedForeground: 'hsl(208 10% 71%)',
    accent: 'hsl(213 17% 13%)',
    accentForeground: COLORS.text,
    destructive: COLORS.notification,
    destructiveForeground: 'hsl(0 0% 100%)',
    border: COLORS.border,
    input: COLORS.border,
    ring: COLORS.primary,
    radius: '0.875rem',
  },
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
