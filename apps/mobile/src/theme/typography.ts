import { Platform, TextStyle } from 'react-native';

/**
 * Weyro typography.
 *
 * Display face: **Sora** (600) — loaded once in `app/_layout.tsx` via
 * `@expo-google-fonts/sora`. It is reserved for the moments: hero headline
 * and big figures (KPI numbers). Interface text remains the system family.
 *
 * Contracts: constants below are the single import surface; when the font
 * is not yet loaded, `displayFamily` falls back to `fontFamilyMedium`
 * (system) so text renders before the font swap and nothing breaks.
 */
export const displayFamily = Platform.select({
  ios: 'Sora_600SemiBold',
  android: 'Sora_600SemiBold',
  default: 'System',
});

export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const fontFamilyMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const fontFamilyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const;

/** Type scale: display / title / heading / body / caption / label. */
export const typography = {
  display: {
    fontFamily: displayFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.5,
  } as TextStyle,
  title: {
    fontFamily: displayFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  } as TextStyle,
  heading: {
    fontFamily: fontFamilyMedium,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
  },
  body: {
    fontFamily,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: fontFamilyMedium,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.medium,
  },
  caption: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.regular,
  },
  captionMedium: {
    fontFamily: fontFamilyMedium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
  },
  label: {
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
  },
  mono: {
    fontFamily: fontFamilyMono,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

export default typography;
