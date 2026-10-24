/**
 * Weyro theme — colors (Palette B: "Slate Teal" Premium Light).
 * Single source of truth for every color used in the app.
 * Do NOT hardcode hex values in screens; import from here.
 *
 * Mood: premium white/light — near-white canvas, pure-white cards, cool
 * graphite text, one deep burnt-orange accent (brand lineage of the gear
 * mark) used sparingly. All essential text pairs pass WCAG AA (≥4.5:1),
 * verified with a contrast script; textMuted (3.2:1) is large/UI use only.
 *
 * NativeWind components read the equivalent CSS variables in `global.css`
 * (`--background`, `--primary`, …) — keep the two files in sync.
 */

export const palette = {
  // Surfaces / backgrounds
  canvas: '#F5F6F7', // app background (soft slate off-white, not pure white)
  surface: '#FFFFFF', // raised cards / sheets (pure white)
  surfaceAlt: '#ECEEF0', // sunken / inset areas, skeletons

  // Borders
  border: '#E1E4E8',
  borderStrong: '#C9CFD6',

  // Text
  textPrimary: '#171A1D', // cool graphite near-black (not pure black)
  textSecondary: '#4B5560',
  textMuted: '#808A96', // large / UI use only — not body copy

  // Accent (single accent, used sparingly for primary actions & key status)
  accent: '#C2410C', // burnt brand orange (gear lineage) — white text 5.18:1
  accentPressed: '#9A3412',
  accentSoftBg: '#FDF0E7', // accent-tinted background (selection, info pills)

  // Semantic (muted, harmonious with the base)
  success: '#2A7050',
  successSoftBg: '#E4F0EA',
  warning: '#8A6410',
  warningSoftBg: '#F5EEDC',
  danger: '#A32C24',
  dangerSoftBg: '#F6E7E5',

  // On-color text (text placed ON an accent/semantic fill)
  onAccent: '#FFFFFF', // white on deep teal (5.9:1)
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
