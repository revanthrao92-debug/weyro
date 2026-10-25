/**
 * Weyro theme — spacing scale.
 * Locked scale: 4 / 8 / 12 / 16 / 24 / 32. Use these instead of magic numbers.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

export default spacing;
