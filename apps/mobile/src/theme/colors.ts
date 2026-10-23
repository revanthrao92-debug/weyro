/**
 * Weyro theme — colors (Palette B: "Slate Teal").
 * Single source of truth for every color used in the app.
 * Do NOT hardcode hex values in screens; import from here.
 *
 * Mood: precise, engineered, calm-confident. One deep desaturated teal
 * accent used sparingly; muted semantic colors. All essential text pairs
 * pass WCAG AA (see docs/ui-redesign-plan.md for measured ratios).
 */

export const palette = {
  // Surfaces / backgrounds
  canvas: '#F5F6F7', // app background (soft slate off-white, not pure white)
  surface: '#FCFDFD', // raised cards / sheets
  surfaceAlt: '#ECEEF0', // sunken / inset areas, skeletons

  // Borders
  border: '#E1E4E8',
  borderStrong: '#C9CFD6',

  // Text
  textPrimary: '#171A1D', // cool graphite near-black (not pure black)
  textSecondary: '#4B5560',
  textMuted: '#808A96', // large / UI use only — not body copy

  // Accent (single accent, used sparingly for primary actions & key status)
  accent: '#1F6F6B',
  accentPressed: '#175551',
  accentSoftBg: '#E6F0EF', // accent tinted background (focus rings, selection)

  // Semantic (muted, harmonious with the base)
  success: '#2E7D5B',
  successSoftBg: '#E4F0EA',
  warning: '#8A6410',
  warningSoftBg: '#F5EEDC',
  danger: '#A32C24',
  dangerSoftBg: '#F6E7E5',

  // On-color text (text placed ON an accent/semantic fill)
  onAccent: '#FFFFFF',
  onSuccess: '#FFFFFF',
  onWarning: '#FFFFFF',
  onDanger: '#FFFFFF',

  // Utility
  overlay: 'rgba(23, 26, 29, 0.45)', // scrim behind sheets/modals
  transparent: 'transparent',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof palette;

/** Map a high-level semantic role to a concrete color for status pills, etc. */
export const statusColors = {
  neutral: { fg: palette.textSecondary, bg: palette.surfaceAlt },
  info: { fg: palette.accent, bg: palette.accentSoftBg },
  success: { fg: palette.success, bg: palette.successSoftBg },
  warning: { fg: palette.warning, bg: palette.warningSoftBg },
  danger: { fg: palette.danger, bg: palette.dangerSoftBg },
} as const;

export type StatusTone = keyof typeof statusColors;

export default palette;
