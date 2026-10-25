/**
 * Weyro theme — corner radii.
 * Reduced from 9 ad-hoc values to 3 + pill. Consistency over novelty.
 */

export const radii = {
  sm: 8, // small controls, chips, inline tags
  md: 12, // inputs, buttons, standard cards
  lg: 20, // sheets, modals, feature/hero cards
  pill: 999, // fully rounded (status pills, avatars-as-pills)
} as const;

export type RadiusToken = keyof typeof radii;

export default radii;
