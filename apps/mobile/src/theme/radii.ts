/**
 * Weyro theme — corner radii.
 * Reduced from 9 ad-hoc values to 3 + pill. Consistency over novelty.
 */

export const radii = {
  sm: 4, // inline tags
  md: 8, // inputs, buttons, standard cards
  lg: 12, // sheets, modals
  pill: 999, // avatars and circular controls only
} as const;

export type RadiusToken = keyof typeof radii;

export default radii;
