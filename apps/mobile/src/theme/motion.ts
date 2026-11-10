import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens — single source of truth for every animation in the app.
 * Keep motions short and transform/opacity-only so they stay on the UI thread.
 */
export const durations = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 320,
} as const;

export const easings = {
  /** Decelerating — entrances, reveals. */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** Accelerating — exits, dismissals. */
  in: Easing.bezier(0.4, 0, 1, 1),
  standard: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

export const springs = {
  /** Press feedback — quick, no visible bounce. */
  press: { damping: 22, stiffness: 320, mass: 0.6 },
  /** Sheets and larger surfaces. */
  sheet: { damping: 20, stiffness: 220, mass: 0.9 },
} as const;

/** Distance (pt) for entrance slides. Small on purpose. */
export const slideDistance = 14;

/** Common delays for staggered entrances. */
export const stagger = (index: number, step = 45) => index * step;
