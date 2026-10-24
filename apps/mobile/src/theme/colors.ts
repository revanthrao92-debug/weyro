/**
 * Weyro theme — colors (Premium Automotive Dark).
 * Single source of truth for every color used in the app.
 * Do NOT hardcode hex values in screens; import from here.
 *
 * Mood: sophisticated dark interface — graphite near-black canvas, raised
 * cool-black surfaces, one restrained teal accent (brightened from Palette B
 * to hold contrast on dark). Semantic colors are lifted for dark legibility.
 * All essential text pairs pass WCAG AA (≥4.5:1), verified with a contrast
 * script during integration.
 *
 * NativeWind components read the equivalent CSS variables in `global.css`
 * (`--background`, `--primary`, …) — keep the two files in sync.
 */

export const palette = {
  // Surfaces / backgrounds
  canvas: '#0D1013', // app background (graphite near-black, not pure black)
  surface: '#14181C', // raised cards / sheets
  surfaceAlt: '#1B2026', // sunken / inset areas, skeletons

  // Borders
  border: '#252B31',
  borderStrong: '#39424A',

  // Text
  textPrimary: '#F1F4F6', // cool white (17.3:1 on canvas)
  textSecondary: '#AEB6BD', // secondary copy (9.3:1 on canvas)
  textMuted: '#7B858E', // large / UI use only — not body copy (5.1:1 on canvas)

  // Accent (single accent, used sparingly for primary actions & key status)
  accent: '#2F9E95', // restrained deep teal — brightened Palette B lineage
  accentPressed: '#33A79E', // pressed state lifts on dark (ink stays AA)
  accentSoftBg: '#102B29', // accent-tinted background (selection, info pills)

  // Semantic (lifted for dark legibility, still muted)
  success: '#52A779',
  successSoftBg: '#152E22',
  warning: '#D6A44A',
  warningSoftBg: '#33270F',
  danger: '#DE6A61',
  dangerSoftBg: '#3A1B19',

  // On-color text (text placed ON an accent/semantic fill)
  onAccent: '#07110F', // dark ink on bright teal fill (5.9:1)
  onSuccess: '#0A130D',
  onWarning: '#171104',
  onDanger: '#FFFFFF', // white on the deep destructive fill (--destructive)

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
