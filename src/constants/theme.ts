/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    primary: '#0F52BA',
    primarySurface: 'rgba(15, 82, 186, 0.12)',
    card: '#ffffff',
    inverseText: '#ffffff',
    success: '#10B981',
    successSurface: 'rgba(16, 185, 129, 0.12)',
    danger: '#EF4444',
    dangerSurface: 'rgba(239, 68, 68, 0.12)',
    info: '#3B82F6',
    warning: '#D97706',
    warningSurface: 'rgba(217, 119, 6, 0.12)',
    border: 'rgba(0, 0, 0, 0.08)',
    muted: '#EEF2F6',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    primary: '#0F52BA',
    primarySurface: 'rgba(15, 82, 186, 0.25)',
    card: '#121212',
    inverseText: '#ffffff',
    success: '#10B981',
    successSurface: 'rgba(16, 185, 129, 0.20)',
    danger: '#EF4444',
    dangerSurface: 'rgba(239, 68, 68, 0.20)',
    info: '#3B82F6',
    warning: '#D97706',
    warningSurface: 'rgba(217, 119, 6, 0.20)',
    border: 'rgba(255, 255, 255, 0.08)',
    muted: '#1A1A1E',
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
