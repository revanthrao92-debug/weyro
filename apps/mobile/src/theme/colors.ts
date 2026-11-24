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
 * only for destructive/error states — never decoratively. Booking/job status
 * has its own three colours (blue active, amber in progress, green done) so a
 * status is readable at a glance; orange stays reserved for actions.
 *
 * Legacy token names are kept where screens still reference them, so the
 * palette can change without touching component APIs.
 */

export const palette = {
  // Graphite Black — primary background / surfaces / navigation
  canvas: '#101214', // deep immersive background
  surface: '#1D2024', // elevated surfaces
  surfaceAlt: '#17191C', // graphite inset (inputs, wells)

  // Chrome — same graphite
  header: '#101214',
  headerAlt: '#17191C', // graphite block
  onHeader: '#F5F5F3',
  onHeaderMuted: '#A7ADB4', // titanium
  scrim: 'rgba(16, 18, 20, 0.55)',
  scrimStrong: 'rgba(16, 18, 20, 0.80)', // over photography where text must stay readable

  // Titanium Silver — hierarchy, lines, icons
  border: '#2B2E31', // titanium 18% over deep
  borderStrong: '#3D4144', // titanium 30% over deep
  textPrimary: '#F5F5F3',
  textSecondary: '#A7ADB4', // titanium
  textMuted: '#7E838A', // titanium ~72% (AA)

  // Performance Orange — meaningful interactions only
  accent: '#FF5A1F',
  accentPressed: '#E24E18',
  accentSoftBg: 'rgba(255, 90, 31, 0.12)',
  onAccent: '#101214',

  // Legacy aliases — resolve to the orange accent
  teal: '#FF5A1F',
  tealPressed: '#E24E18',
  tealSoftBg: 'rgba(255, 90, 31, 0.12)',

  // Functional only — destructive / error
  danger: '#E06455',
  dangerPressed: '#C95547',
  dangerSoftBg: 'rgba(224, 100, 85, 0.12)',
  onDanger: '#101214',

  // Job status (AA ≥ 5:1 on canvas, surface and their soft fills)
  statusActive: '#6CA6F0', // confirmed / on the way
  statusActiveSoftBg: 'rgba(108, 166, 240, 0.14)',
  statusProgress: '#F2B441', // in progress / attention
  statusProgressSoftBg: 'rgba(242, 180, 65, 0.14)',
  statusDone: '#4CC38A', // completed / verified
  statusDoneSoftBg: 'rgba(76, 195, 138, 0.14)',
  // Legacy status tokens
  success: '#4CC38A', // = statusDone
  successSoftBg: 'rgba(76, 195, 138, 0.14)',
  warning: '#F2B441', // = statusProgress
  warningSoftBg: 'rgba(242, 180, 65, 0.14)',
  onSuccess: '#101214',
  onWarning: '#101214',

  // Utility
  overlay: 'rgba(16, 18, 20, 0.75)',
  transparent: 'transparent',
  white: '#A7ADB4', // titanium — do not introduce a fourth text colour
} as const;

export type ColorToken = keyof typeof palette;

/** Map a high-level semantic role to a concrete colour for status pills. */
export const statusColors = {
  neutral: { fg: palette.textSecondary, bg: palette.surfaceAlt },
  info: { fg: palette.statusActive, bg: palette.statusActiveSoftBg },
  progress: { fg: palette.statusProgress, bg: palette.statusProgressSoftBg },
  success: { fg: palette.statusDone, bg: palette.statusDoneSoftBg },
  warning: { fg: palette.statusProgress, bg: palette.statusProgressSoftBg },
  danger: { fg: palette.danger, bg: palette.dangerSoftBg },
} as const;

export type StatusTone = keyof typeof statusColors;

export default palette;
