import { Platform, ViewStyle } from 'react-native';
import { palette } from './colors';

/**
 * Weyro theme — elevation.
 * Soft, never heavy. A hairline border carries most of the definition;
 * shadows are a whisper of depth, not a drop-shadow showpiece.
 */

export const elevation = {
  none: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Standard card: hairline border + whisper of shadow. */
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: palette.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
  /** Raised surfaces: sheets, floating bars. */
  sheet: Platform.select<ViewStyle>({
    ios: {
      shadowColor: palette.textPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle,
} as const;

export type ElevationToken = keyof typeof elevation;

export default elevation;
