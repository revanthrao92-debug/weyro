/**
 * Weyro theme — colours (light, "road signage").
 *
 * Paper white surfaces, road-grey text, sign green for actions, reflective
 * yellow only for SOS/urgent, red only for destructive/error. Job status has
 * its own blue / amber / green so a status reads at a glance. Scrims stay dark
 * because they sit over photography (use onPhoto for text there).
 *
 * Token names are kept from the previous palette so screens don't change.
 */

export const palette = {
  // Paper — backgrounds and surfaces (light: readable outdoors and in sun)
  canvas: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0ED', // inset wells, inputs

  // Chrome — same paper as the canvas
  header: '#F7F8F6',
  headerAlt: '#FFFFFF',
  onHeader: '#1F2427',
  onHeaderMuted: '#5B6368',
  // Scrims stay dark: they sit over photography, with onPhoto text on top
  scrim: 'rgba(10, 12, 14, 0.45)',
  scrimStrong: 'rgba(10, 12, 14, 0.72)',
  onPhoto: '#FFFFFF',
  onPhotoMuted: '#E3E6E8',

  // Road grey — text, lines, icons
  border: '#D9DDD8',
  borderStrong: '#BFC5BF',
  textPrimary: '#1F2427',
  textSecondary: '#3F474C',
  textMuted: '#5B6368', // AA on canvas and surface

  // Sign green — actions, selection, active navigation
  accent: '#0E5A43',
  accentPressed: '#0A4634',
  accentSoftBg: 'rgba(14, 90, 67, 0.10)',
  onAccent: '#FFFFFF',

  // Legacy aliases — resolve to the accent
  teal: '#0E5A43',
  tealPressed: '#0A4634',
  tealSoftBg: 'rgba(14, 90, 67, 0.10)',

  // Reflective yellow — SOS / urgent only
  sos: '#F2C230',
  onSos: '#1F2427',

  // Functional only — destructive / error
  danger: '#B42318',
  dangerPressed: '#912018',
  dangerSoftBg: 'rgba(180, 35, 24, 0.08)',
  onDanger: '#FFFFFF',

  // Job status (AA on canvas, surface and their soft fills)
  statusActive: '#1F5FAD', // confirmed / on the way
  statusActiveSoftBg: 'rgba(31, 95, 173, 0.10)',
  statusProgress: '#8A5A00', // in progress / attention
  statusProgressSoftBg: 'rgba(242, 180, 65, 0.22)',
  statusDone: '#17683F', // completed / verified
  statusDoneSoftBg: 'rgba(23, 104, 63, 0.10)',
  // Legacy status tokens
  success: '#17683F', // = statusDone
  successSoftBg: 'rgba(23, 104, 63, 0.10)',
  warning: '#8A5A00', // = statusProgress
  warningSoftBg: 'rgba(242, 180, 65, 0.22)',
  onSuccess: '#FFFFFF',
  onWarning: '#FFFFFF',

  // Utility
  overlay: 'rgba(10, 12, 14, 0.55)', // modal backdrops, badges over photos
  transparent: 'transparent',
  white: '#FFFFFF',
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
