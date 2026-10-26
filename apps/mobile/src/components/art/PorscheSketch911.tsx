import { Svg, Path, Circle, Line } from 'react-native-svg';

/**
 * Porsche 911 side-profile sketch — line art for dark hero backgrounds.
 * Pure react-native-svg (already a dependency — no new packages).
 * Stroke-only, elegant single-line drawing; opacity/color controlled by
 * the parent so it can sit behind any dark chrome.
 *
 * Reversibility with the photo hero: see `HERO_MODE` in
 * `src/app/(auth)/login.tsx` — flip one constant to switch back
 * ('sketch' <-> 'photo').
 */

export function PorscheSketch911({
  color = '#FFFFFF',
  opacity = 0.22,
  strokeWidth = 2.5,
}: {
  color?: string;
  opacity?: number;
  strokeWidth?: number;
}) {
  const common = {
    stroke: color,
    strokeOpacity: opacity,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
  };

  // 911 silhouette, front facing right. viewBox 0 0 960 360, ground y=268.
  const body =
    'M 84 252 ' + // rear bumper lower
    'C 74 232 78 210 96 196 ' + // rear face up
    'C 128 172 190 140 268 122 ' + // rear deck rising
    'C 330 110 400 100 452 102 ' + // roof approach (911 flyline)
    'C 500 104 540 116 570 134 ' + // windshield slope
    'C 610 158 660 172 716 182 ' + // hood to front fender
    'C 770 190 820 200 846 216 ' + // nose
    'C 862 226 866 238 860 248 ' + // front bumper lip
    'L 818 254'; // front lower lip end (before front wheel)

  // Underside rear segment (between rear bumper and rear wheel arch)
  const undersideRear = 'M 84 252 L 128 256';

  // Wheel arches (front and rear) — open arcs over each wheel
  const archRear = 'M 172 254 A 62 62 0 0 1 290 252';
  const archFront = 'M 692 254 A 62 62 0 0 1 812 252';

  // Side window (D-shape of the 911 cabin glass)
  const glass =
    'M 300 138 ' +
    'C 360 122 430 114 470 116 ' +
    'C 508 118 538 128 560 142 ' +
    'L 540 156 ' +
    'C 480 146 400 146 336 152 Z';

  // Door cut + handle
  const door = 'M 402 118 C 396 166 396 210 402 244';
  const handle = 'M 420 176 L 448 174';

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 960 360"
      preserveAspectRatio="xMidYMax meet"
    >
      <Path d={body} {...common} />
      <Path d={undersideRear} {...common} />
      <Path d={archRear} {...common} />
      <Path d={archFront} {...common} />
      <Path d={glass} {...common} strokeWidth={strokeWidth * 0.8} />
      <Path d={door} {...common} strokeWidth={strokeWidth * 0.7} />
      <Path d={handle} {...common} strokeWidth={strokeWidth * 0.9} />
      {/* Wheels — circles + hub detail */}
      <Circle cx={230} cy={256} r={46} {...common} strokeWidth={strokeWidth * 1.2} />
      <Circle cx={230} cy={256} r={18} {...common} strokeWidth={strokeWidth * 0.7} />
      <Circle cx={750} cy={256} r={46} {...common} strokeWidth={strokeWidth * 1.2} />
      <Circle cx={750} cy={256} r={18} {...common} strokeWidth={strokeWidth * 0.7} />
      {/* Ground line under the car */}
      <Line x1={40} y1={310} x2={920} y2={310} {...common} strokeWidth={strokeWidth * 0.6} />
    </Svg>
  );
}
