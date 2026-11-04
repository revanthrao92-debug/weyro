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
  canvas: '#080B0E', // Carbon Black — page background
  surface: '#171D23', // Elevated Surface — cards
  surfaceAlt: '#1B222A', // Inset — inputs, wells, skeletons

  // Dark chrome (headers, hero, tab bar)
  header: '#10151A', // Graphite
  headerAlt: '#0B0F13', // deeper chrome for hero blocks
  onHeader: '#F5F6F7', // Titanium White
  onHeaderMuted: '#A3ADB6', // Secondary Text

  // Lines
  border: '#303941', // Metallic Grey hairline
  borderStrong: '#3E4750', // derived stronger hairline

  // Text (three roles)
  textPrimary: '#F5F6F7',
  textSecondary: '#A3ADB6',
  textMuted: '#6E7A84', // derived muted role — large/UI use only

  // CTA — Racing Orange (primary buttons only)
  accent: '#F47721',
  accentPressed: '#E0591A',
  accentSoftBg: '#F477211F', // 12% orange tint for selected states
  onAccent: '#080B0E', // Carbon ink on orange (≈9:1 contrast)

  // Legacy alias — link/active color. In Carbon identity, links use the accent.
  teal: '#F47721',
  tealPressed: '#E0591A',
  tealSoftBg: '#F477211F',

  // New-world additions
  chrome: '#10151A', // synonym of header
  elevated: '#171D23', // synonym of surface
  inset: '#1B222A', // synonym of surfaceAlt
  metallic: '#303941', // synonym of border
  highlight: '#FF8A32', // Orange Highlight — live moments only
  scrim: 'rgba(5, 8, 11, 0.72)', // deep carbon scrim over photography
  scrimSoft: 'rgba(5, 8, 11, 0.52)',
  panel: '#101820', // deep panel fallback behind imagery
  glass: 'rgba(245, 246, 247, 0.10)', // titanium glass line on imagery
  glassBorder: 'rgba(245, 246, 247, 0.16)',

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
