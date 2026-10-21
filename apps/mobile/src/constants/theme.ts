/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#FFFFFF',
    backgroundElement: '#F2F2F7',
    backgroundSelected: '#E5E5EA',
    textSecondary: '#6E6E73',
    tertiary: '#C7C7CC',
    separator: '#E5E5EA',
    primary: '#007AFF',
    primarySurface: 'rgba(0, 122, 255, 0.12)',
    card: '#FFFFFF',
    inverseText: '#FFFFFF',
    success: '#34C759',
    successSurface: 'rgba(52, 199, 89, 0.12)',
    danger: '#FF3B30',
    dangerSurface: 'rgba(255, 59, 48, 0.12)',
    info: '#007AFF',
    warning: '#FF9500',
    warningSurface: 'rgba(255, 149, 0, 0.12)',
    border: 'rgba(0, 0, 0, 0.08)',
    muted: '#F2F2F7',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    textSecondary: '#8E8E93',
    tertiary: '#3A3A3C',
    separator: '#2C2C2E',
    primary: '#0A84FF',
    primarySurface: 'rgba(10, 132, 255, 0.25)',
    card: '#1C1C1E',
    inverseText: '#FFFFFF',
    success: '#32D74B',
    successSurface: 'rgba(50, 215, 75, 0.20)',
    danger: '#FF453A',
    dangerSurface: 'rgba(255, 69, 58, 0.20)',
    info: '#0A84FF',
    warning: '#FF9F0A',
    warningSurface: 'rgba(255, 159, 10, 0.20)',
    border: 'rgba(255, 255, 255, 0.08)',
    muted: '#1C1C1E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Elevation = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  low: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  medium: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  high: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 },
  floating: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.20, shadowRadius: 24, elevation: 12 },
} as const;

export const BorderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 20,
  round: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
