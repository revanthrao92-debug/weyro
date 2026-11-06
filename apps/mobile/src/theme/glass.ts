import { StyleSheet, ViewStyle } from 'react-native';
import { palette } from './colors';

/**
 * GLASSMORPHISM — single source of truth.
 *
 * Every glass surface in the app derives from these tokens. To remove
 * glassmorphism from the whole app:
 *   1. set `GLASS_ENABLED = false` (falls back to opaque Carbon surfaces)
 *   2. delete this file + revert the ~4 `import { glass }` call sites
 *
 * Implementation is performance-safe: translucent tint layers + hairline
 * borders + 3 gradient hues — no native blur, no expensive effects.
 */

export const GLASS_ENABLED = false;

const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

export const glass = {
  // Surface fills — near-invisible tint over the carbon background
  bg: GLASS_ENABLED ? 'rgba(255, 255, 255, 0.05)' : palette.surface,
  bgStrong: GLASS_ENABLED ? 'rgba(255, 255, 255, 0.09)' : palette.surfaceAlt,
  bgInput: GLASS_ENABLED ? 'rgba(255, 255, 255, 0.04)' : palette.surfaceAlt,

  // Hairlines — metallic edge, brighter on top edge for the glass bevel
  border: GLASS_ENABLED ? 'rgba(255, 255, 255, 0.14)' : palette.border,
  borderStrong: GLASS_ENABLED ? 'rgba(255, 255, 255, 0.22)' : palette.borderStrong,

  // Depth — the darker layer strokes under the surface
  innerShade: 'rgba(0, 0, 0, 0.28)',

  // Panel-over-glass (>Login sheet, modals): darker, frosted
  sheet: GLASS_ENABLED ? 'rgba(20, 22, 24, 0.78)' : palette.surface,

  // Accent-glass: orange CTA with glass treatment
  accentBg: GLASS_ENABLED ? alpha('#FF5A1F', 0.16) : palette.accentSoftBg,
} as const;

/**
 * Compose a glass card style. `strong` doubles the tint (primary
 * surfaces, e.g. dealer cards).
 */
export function glassCard(strong = false): ViewStyle {
  return {
    backgroundColor: strong ? glass.bgStrong : glass.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    // Subtle top-edge bevel: the glass signature
    ...({ borderTopColor: glass.borderStrong, borderTopWidth: StyleSheet.hairlineWidth } as ViewStyle),
  };
}

/** Glass input field style (Login, forms). */
export const glassInput: ViewStyle = {
  backgroundColor: glass.bgInput,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: glass.border,
};

/** Global glass tokens for StyleSheet spreads. */
export const glassStyles = StyleSheet.create({
  card: glassCard(false) as never as ViewStyle,
  cardStrong: glassCard(true) as never as ViewStyle,
  input: glassInput,
  sheet: {
    backgroundColor: glass.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: glass.borderStrong,
  },
});
