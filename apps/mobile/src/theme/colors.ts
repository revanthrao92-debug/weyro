/**
 * Weyro theme — colours.
 *
 * THREE-COLOUR SYSTEM (single source of truth):
 *   Graphite Black    #17191C  — backgrounds, surfaces, navigation
 *   Titanium Silver   #A7ADB4  — text, borders, dividers, icons
 *   Performance Orange #FF5A1F — actions, selection, active nav, highlights
 *
 * Everything else is a tint/shade of those three (graphite raised/inset,
 * titanium opacity steps, orange pressed/tint). One functional red exists
 * only for destructive/error states — never decoratively.
 *
 * Legacy token names are kept where screens still reference them, so the
 * palette can change without touching component APIs.
 */

export const palette = {
  // Graphite Black — primary background / surfaces / navigation
  canvas: '#17191C',
  surface: '#1C1F23', // raised (cards)
  surfaceAlt: '#121417', // inset (inputs, well behind imagery)

  // Chrome — same graphite
  header: '#17191C',
  headerAlt: '#17191C',
  onHeader: '#A7ADB4', // titanium
  onHeaderMuted: '#8A8F96', // titanium 80%
  scrim: 'rgba(23, 25, 28, 0.55)',
  scrimStrong: 'rgba(23, 25, 28, 0.78)', // over photography where text must stay readable

  // Titanium Silver — hierarchy, lines, icons
  border: '#313437', // titanium 18% over graphite
  borderStrong: '#424549', // titanium 30% over graphite
  textPrimary: '#A7ADB4',
  textSecondary: '#8A8F96', // titanium 80%
  textMuted: '#7E838A', // titanium ~72% (4.61:1 — AA)

  // Performance Orange — meaningful interactions only
  accent: '#FF5A1F',
  accentPressed: '#E24E18',
  accentSoftBg: 'rgba(255, 90, 31, 0.12)',
  onAccent: '#17191C',

  // Legacy aliases — resolve to the orange accent
  teal: '#FF5A1F',
  tealPressed: '#E24E18',
  tealSoftBg: 'rgba(255, 90, 31, 0.12)',

  // Functional only — destructive / error
  danger: '#E06455',
  dangerPressed: '#C95547',
  dangerSoftBg: 'rgba(224, 100, 85, 0.12)',
  onDanger: '#17191C',

  // Status tokens (no green/amber — status is carried by label + orange/titanium)
  success: '#A7ADB4',
  successSoftBg: '#1C1F23',
  warning: '#FF5A1F',
  warningSoftBg: 'rgba(255, 90, 31, 0.12)',
  onSuccess: '#17191C',
  onWarning: '#17191C',

  // Utility
  overlay: 'rgba(23, 25, 28, 0.72)',
  transparent: 'transparent',
  white: '#A7ADB4', // titanium — do not introduce a fourth text colour
} as const;

export type ColorToken = keyof typeof palette;

/** Map a high-level semantic role to a concrete colour for status pills. */
export const statusColors = {
  neutral: { fg: palette.textSecondary, bg: palette.surfaceAlt },
  info: { fg: palette.accent, bg: palette.accentSoftBg },
  success: { fg: palette.textPrimary, bg: palette.surfaceAlt },
  warning: { fg: palette.accent, bg: palette.accentSoftBg },
  danger: { fg: palette.danger, bg: palette.dangerSoftBg },
} as const;

export type StatusTone = keyof typeof statusColors;

export default palette;
