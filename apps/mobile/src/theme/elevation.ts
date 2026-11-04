/**
 * Weyro theme — elevation. DARK THEME rules from the design system:
 * depth comes from surface steps and metallic hairlines, not drop shadows.
 * The token shape is preserved (props spread) so existing screens do not
 * break; each level now reads as +1 surface step over Carbon Black.
 */
import { Platform, ViewStyle } from 'react-native';

export const elevation = {
  none: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Standard card: hairline border for definition, no shadow. */
  card: Platform.select<ViewStyle>({
    ios: { shadowOpacity: 0 },
    android: { elevation: 0 },
    default: {},
  }) as ViewStyle,
  /** Raised surfaces: +1 step (visually enforced via border tokens). */
  sheet: Platform.select<ViewStyle>({
    ios: { shadowOpacity: 0 },
    android: { elevation: 0 },
    default: {},
  }) as ViewStyle,
} as const;

export type ElevationToken = keyof typeof elevation;

export default elevation;
