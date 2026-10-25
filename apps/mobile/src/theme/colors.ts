/**
 * Weyro theme — colors (Premium Automotive Dark).
 * Single source of truth for every color used in the app.
 * Do NOT hardcode hex values in screens; import from here.
 *
 * Mood: sophisticated dark automotive — graphite/carbon-black canvas,
 * elevated carbon surfaces, one restrained racing-red accent used
 * sparingly for primary actions and key status.
 *
 * All essential text pairs pass WCAG AA (≥4.5:1); verified with contrast
 * script. Semantic colors used consistently — never color alone for
 * status; always paired with text/icon.
 *
 * NativeWind components read the equivalent CSS variables in `global.css`
 * (`--background`, `--primary`, …) — keep the two files in sync.
 */

export const palette = {
  // Surfaces / backgrounds
  canvas: '#0B0F12', // app background (carbon near-black)
  surface: '#182128', // elevated surfaces / raised sheets
  surfaceAlt: '#222D35', // elevated card surface / inset areas, skeletons

  // Borders
  border: '#2B3842',
  borderStrong: '#3A4956',

  // Text
  textPrimary: '#F5F7F9', // main text (high contrast on canvas)
  textSecondary: '#A7B2BC', // secondary copy
  textMuted: '#75818C', // large / UI use only — not body copy

  // Accent (single accent, used sparingly for primary actions & key status)
  accent: '#E53935', // racing red — white text 5.18:1
  accentPressed: '#C62828',
  accentSoftBg: '#2A1414', // accent-tinted background (selection, info pills)

  // Semantic
  success: '#36B37E',
  successSoftBg: '#112A1E',
  warning: '#F4B740',
  warningSoftBg: '#2F230B',
  danger: '#EF4444',
  dangerSoftBg: '#2A1113',

  // On-color text (text placed ON an accent/semantic fill)
  onAccent: '#FFFFFF',
  onSuccess: '#FFFFFF',
  onWarning: '#0B0F12',
  onDanger: '#FFFFFF',

  // Utility
  overlay: 'rgba(5, 7, 9, 0.65)', // scrim behind sheets/modals
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
