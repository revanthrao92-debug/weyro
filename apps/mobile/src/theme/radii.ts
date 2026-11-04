/**
 * Weyro theme — radii. ANGULAR system: corners reduced so panels read as
 * structured, machined parts. `pill` survives only where roundness is
 * semantic (avatars, live dots).
 */

export const radii = {
  xs: 4, // tag ticks, tiny controls
  sm: 6, // chips, small controls
  md: 10, // inputs, buttons, standard cards
  lg: 14, // feature/hero cards, sheets
  sheet: 18, // top-corner sheet edge
  pill: 999, // avatars, status dots
} as const;

export type RadiusToken = keyof typeof radii;

export default radii;
