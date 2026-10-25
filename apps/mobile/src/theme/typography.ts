import { Platform, TextStyle } from 'react-native';

/**
 * Weyro theme — typography.
 * System font only (no new font dependencies). One family, clear scale.
 * Weights limited to regular / medium / semibold.
 */

export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
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
    fontFamily: fontFamilyMedium,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: fontWeight.semibold,
  },
  title: {
    fontFamily: fontFamilyMedium,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: fontWeight.semibold,
  },
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.medium,
  },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

export default typography;
