/**
 * Weyro theme — colors (Premium Automotive — hybrid light/dark).
 * Single source of truth for every color used in the app.
 * Do NOT hardcode hex values in screens; import from here.
 *
 * Direction (matches the approved reference design):
 * - Light content canvas with white cards
 * - Deep navy/graphite chrome for headers, hero areas and onboarding
 * - Buttons: brand orange (#FF6A00, matches the gear logo) with dark
 *   ink text — reserved for primary CTAs only
 * - Teal for links, active states, info pills and secondary accents
 *
 * All essential text pairs pass WCAG AA (≥4.5:1). Semantic colors are
 * always paired with text/icons — never color alone.
 *
 * NativeWind components read the equivalent CSS variables in `global.css`
 * (`--background`, `--primary`, …) — keep the two files in sync.
 */

export const palette = {
  // Content surfaces (light)
  canvas: '#F5F8FA', // app content background
  surface: '#FFFFFF', // cards / sheets
  surfaceAlt: '#F1F5F7', // sunken / inset areas, skeletons

  // Dark chrome (headers, hero, onboarding)
  header: '#06151E', // deep navy-teal header bar
  headerAlt: '#031923', // darker hero overlay base
  onHeader: '#FFFFFF', // text on dark chrome
  onHeaderMuted: '#A8BAC4', // secondary text on dark chrome

  // Borders (light content)
  border: '#E3EAEE',
  borderStrong: '#CBD8DE',

  // Text on light content
  textPrimary: '#0B1F2A', // near-black navy graphite
  textSecondary: '#546772',
  textMuted: '#8A98A1', // large / UI use only

  // CTA — brand orange (matches gear logo; primary buttons only)
  accent: '#FF6A00',
  accentPressed: '#E65800',
  accentSoftBg: '#FFF0E5', // CTA-tinted background
  onAccent: '#0B1F2A', // dark ink on orange (5.88:1)

  // Secondary accent — deep teal (links, active states, info pills)
  teal: '#017365',
  tealPressed: '#015A4F',
  tealSoftBg: '#E6F3F0',

  // Semantic
  success: '#1F9D6B',
  successSoftBg: '#E4F4ED',
  warning: '#B07A0B',
  warningSoftBg: '#FBF1DC',
  danger: '#D64545',
  dangerSoftBg: '#FBE8E8',

  // On-color text (text placed ON a semantic fill)
  onSuccess: '#FFFFFF',
  onWarning: '#FFFFFF',
  onDanger: '#FFFFFF',

  // Utility
  overlay: 'rgba(4, 12, 16, 0.55)', // scrim behind sheets/modals
  transparent: 'transparent',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof palette;

/** Map a high-level semantic role to a concrete color for status pills, etc. */
export const statusColors = {
  neutral: { fg: palette.textSecondary, bg: palette.surfaceAlt },
  info: { fg: palette.teal, bg: palette.tealSoftBg },
  success: { fg: palette.success, bg: palette.successSoftBg },
  warning: { fg: palette.warning, bg: palette.warningSoftBg },
  danger: { fg: palette.danger, bg: palette.dangerSoftBg },
} as const;

export type StatusTone = keyof typeof statusColors;

export default palette;
