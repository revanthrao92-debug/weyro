/**
 * Weyro theme — corner radii.
 * Reduced from 9 ad-hoc values to 3 + pill. Consistency over novelty.
 */

export const radii = {
  sm: 4, // inline tags
  md: 10, // inputs, buttons
  lg: 12, // every card and sheet (one card radius app-wide)
  pill: 999, // avatars and circular controls only
} as const;

export type RadiusToken = keyof typeof radii;

export default radii;
