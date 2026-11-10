/**
 * Weyro design system — theme barrel.
 * Import everything from '@/theme':
 *   import { palette, spacing, radii, typography, elevation } from '@/theme';
 *
 * Every screen/component should pull colors, spacing, radii, type, and
 * elevation from here. No hardcoded hex or magic numbers after migration.
 */

import { palette } from './colors';
import { spacing } from './spacing';
import { radii } from './radii';
import { typography } from './typography';
import { elevation } from './elevation';

export { palette, statusColors } from './colors';
export type { ColorToken, StatusTone } from './colors';

export { spacing } from './spacing';
export type { SpacingToken } from './spacing';

export { radii } from './radii';
export type { RadiusToken } from './radii';

export {
  typography,
  fontWeight,
  fontFamily,
  fontFamilyMedium,
  displayFamily,
  fontFamilyMono,
} from './typography';
export type { TypographyToken } from './typography';

export { elevation } from './elevation';
export type { ElevationToken } from './elevation';

export { durations, easings, springs, slideDistance, stagger } from './motion';

/** The complete theme object for convenience / future ThemeProvider. */
export const theme = {
  colors: palette,
  spacing,
  radii,
  typography,
  elevation,
} as const;

export type Theme = typeof theme;

export default theme;
