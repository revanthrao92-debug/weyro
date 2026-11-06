/**
 * Weyro theme — colors. PREMIUM AUTOMOTIVE / MOTORSPORT LUXURY ("Carbon").
 * Single source of truth for every color used in the app.
 * Do NOT hardcode hex values in screens; import from here.
 *
 * Identity: carbon-black canvas, graphite chrome, elevated surfaces,
 * metallic hairline borders, restrained racing-orange accent.
 * Titanium type. Semantic colors are dark-mode-adjusted.
 *
 * Every token name is kept stable (API-compatible with the teal-era screens);
 * the VALUES changed with the identity cutover (tag `pre-carbon`).
 */

export const palette = {
  // Content surfaces — dark by default now
  canvas: '#0B0C0E', // near-black page background
  surface: '#191C20', // Graphite — cards
  surfaceAlt: '#24282D', // Dark surface — elevated cards, inputs

  // Dark chrome (headers, hero, tab bar)
  header: '#0B0C0E', // same as canvas — header chrome
  headerAlt: '#191C20', // hero blocks match card tone
  onHeader: '#F5F6F7', // Titanium White
  onHeaderMuted: '#A3ADB6', // Secondary Text

  // Lines
  border: '#3A3F45', // hairline borders
  borderStrong: '#4A5058', // stronger hairline

  // Text (three roles)
  textPrimary: '#F4F5F6', // Titanium
  textSecondary: '#A5A9AD', // Metallic grey
  textMuted: '#8A8F94', // muted role

  // CTA — Racing Orange (primary buttons only)
  accent: '#FF5A1F', // Racing Orange — primary actions
  accentPressed: '#E14E17', // darker orange on press
  accentSoftBg: '#FF5A1F22', // orange tint
  onAccent: '#080B0E', // Carbon ink on orange (≈9:1 contrast)

  // Legacy alias — link/active color. In Carbon identity, links use the accent.
  teal: '#FF5A1F', // === accent (orange identity)
  tealPressed: '#E14E17',
  tealSoftBg: '#FF5A1F22',

  // New-world additions
  chrome: '#10151A', // synonym of header
  elevated: '#171D23', // synonym of surface
  inset: '#1B222A', // synonym of surfaceAlt
  metallic: '#303941', // synonym of border
  highlight: '#FF8A32', // Orange highlight (logo gradient end)
  scrim: 'rgba(3, 4, 5, 0.72)', // carbon scrim
  scrimSoft: 'rgba(3, 4, 5, 0.52)',
  panel: '#141618', // deep panel behind imagery
  glass: 'rgba(244, 245, 246, 0.08)', // titanium glass
  glassBorder: 'rgba(244, 245, 246, 0.14)',

  // Semantic — dark-mode-adjusted pairs
  success: '#4CBB87',
  successSoftBg: '#12271C',
  warning: '#E0A32E',
  warningSoftBg: '#2B230F',
  danger: '#E06455',
  dangerSoftBg: '#2B1414',

  // On-color text
  onSuccess: '#080B0E',
  onWarning: '#080B0E',
  onDanger: '#080B0E',

  // Utility
  overlay: 'rgba(0, 0, 0, 0.65)',
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
