import { Svg, Path, Line, Text as SvgText, Circle, G } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';

/**
 * Porsche 911 GT3 RS technical blueprint (scalable SVG).
 *
 * Recreates the reference's engineering-drawing aesthetic:
 * grid paper - 911 side profile - dimension lines - spec annotations.
 *
 * Fully scalable (SVG viewBox), recolorable (color/opacity props),
 * zero network dependency. Used on Home hero + empty states.
 */

const ORANGE = '#FF5A1F';

interface BlueprintProps {
  color?: string;
  opacity?: number;
  grid?: boolean;
  dimensions?: boolean;
  specs?: boolean;
  strokeWidth?: number;
}

export function BlueprintSpec({
  color = '#F5F6F7',
  opacity = 0.3,
  grid = true,
  dimensions = true,
  specs = true,
  strokeWidth = 1.5,
}: BlueprintProps) {
  const ink = {
    stroke: color,
    strokeOpacity: opacity,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
  };

  const dim = {
    stroke: ORANGE,
    strokeOpacity: opacity * 1.2,
    strokeWidth: strokeWidth * 0.7,
    fill: 'none' as const,
  };

  const textProps = {
    fill: color,
    fillOpacity: opacity * 1.1,
    fontSize: 13,
    fontFamily: 'monospace',
  };

  const dimText = {
    fill: ORANGE,
    fillOpacity: opacity * 1.3,
    fontSize: 11,
    fontFamily: 'monospace',
  };

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 960 520"
      preserveAspectRatio="xMidYMid meet"
    >
      {grid && (
        <G opacity={opacity * 0.15}>
          {Array.from({ length: 20 }, (_, i) => (
            <Line key={'gv' + i} x1={i * 48} y1={0} x2={i * 48} y2={520} stroke={color} strokeWidth={0.4} />
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <Line key={'gh' + i} x1={0} y1={i * 48} x2={960} y2={i * 48} stroke={color} strokeWidth={0.4} />
          ))}
        </G>
      )}

      {/* 911 side profile */}
      <G>
        <Path
          d="M 84 252 C 74 232 78 210 96 196 C 128 172 190 140 268 122 C 330 110 400 100 452 102 C 500 104 540 116 570 134 C 610 158 660 172 716 182 C 770 190 820 200 846 216 C 862 226 866 238 860 248 L 818 254"
          {...ink}
        />
        <Path d="M 96 196 C 80 180 70 168 60 164 L 40 160" stroke={color} strokeOpacity={opacity * 0.7} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 60 160 L 40 156 L 44 168" stroke={color} strokeOpacity={opacity * 0.6} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 268 122 C 330 110 400 100 452 102" stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 460 104 L 520 134 L 570 134" stroke={color} strokeOpacity={opacity * 0.6} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path
          d="M 300 138 C 360 122 430 114 470 116 C 508 118 538 128 560 142 L 540 156 C 480 146 400 146 336 152 Z"
          stroke={color}
          strokeOpacity={opacity * 0.5}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M 402 118 C 396 166 396 210 402 244" stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 420 176 L 448 174" stroke={color} strokeOpacity={opacity * 0.6} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 580 160 L 620 168" stroke={color} strokeOpacity={opacity * 0.4} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 584 152 L 624 160" stroke={color} strokeOpacity={opacity * 0.4} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 180 248 L 680 246" stroke={color} strokeOpacity={opacity * 0.4} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Path d="M 830 220 C 838 228 840 236 838 244" stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />

        <Circle cx={230} cy={256} r={46} stroke={color} strokeOpacity={opacity} strokeWidth={strokeWidth * 1.2} fill="none" />
        <Circle cx={230} cy={256} r={18} stroke={color} strokeOpacity={opacity * 0.6} strokeWidth={strokeWidth * 0.7} fill="none" />
        <Line x1={230} y1={210} x2={230} y2={302} stroke={color} strokeOpacity={opacity * 0.3} strokeWidth={strokeWidth * 0.5} />
        <Line x1={184} y1={256} x2={276} y2={256} stroke={color} strokeOpacity={opacity * 0.3} strokeWidth={strokeWidth * 0.5} />
        <Circle cx={750} cy={256} r={46} stroke={color} strokeOpacity={opacity} strokeWidth={strokeWidth * 1.2} fill="none" />
        <Circle cx={750} cy={256} r={18} stroke={color} strokeOpacity={opacity * 0.6} strokeWidth={strokeWidth * 0.7} fill="none" />
        <Line x1={750} y1={210} x2={750} y2={302} stroke={color} strokeOpacity={opacity * 0.3} strokeWidth={strokeWidth * 0.5} />
        <Line x1={704} y1={256} x2={796} y2={256} stroke={color} strokeOpacity={opacity * 0.3} strokeWidth={strokeWidth * 0.5} />

        <Path d="M 60 164 L 30 152 L 26 158 L 56 170" stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <Line x1={40} y1={310} x2={920} y2={310} stroke={color} strokeOpacity={opacity * 0.3} strokeWidth={strokeWidth * 0.5} />
      </G>

      {dimensions && (
        <G>
          <Line x1={84} y1={330} x2={860} y2={330} {...dim} />
          <Line x1={84} y1={324} x2={84} y2={336} {...dim} />
          <Line x1={860} y1={324} x2={860} y2={336} {...dim} />
          <SvgText x={470} y={346} textAnchor="middle" {...dimText}>
            4549 mm
          </SvgText>

          <Line x1={880} y1={100} x2={880} y2={308} {...dim} />
          <SvgText x={892} y={204} textAnchor="middle" {...dimText}>
            1298
          </SvgText>

          <Line x1={230} y1={330} x2={750} y2={330} {...dim} />
          <SvgText x={490} y={320} textAnchor="middle" {...dimText}>
            2457 mm
          </SvgText>

          <SvgText x={820} y={100} textAnchor="end" {...dimText}>
            LED Matrix
          </SvgText>
          <SvgText x={820} y={114} textAnchor="end" {...dimText}>
            Headlights
          </SvgText>
          <Line x1={824} y1={106} x2={850} y2={200} {...dim} strokeDasharray="4 3" />
        </G>
      )}

      {specs && (
        <G>
          <SvgText x={60} y={60} {...textProps}>
            4.0L NA Flat-6
          </SvgText>
          <SvgText x={60} y={78} {...textProps}>
            525 HP @ 8,250 RPM
          </SvgText>
          <SvgText x={60} y={96} {...textProps}>
            465 Nm @ 6,300 RPM
          </SvgText>
          <SvgText x={60} y={114} {...textProps}>
            0-100 km/h : 3.2 s
          </SvgText>
          <SvgText x={60} y={132} {...textProps}>
            Top Speed : 296 km/h
          </SvgText>
          <SvgText x={900} y={30} textAnchor="end" fill={color} fillOpacity={opacity * 1.1} fontSize={18} fontFamily="monospace">
            weyro
          </SvgText>
        </G>
      )}
    </Svg>
  );
}

/** Wrapper with dark backdrop - for use on glass/dark surfaces. */
export function BlueprintPanel({ style }: { style?: object }) {
  return (
    <View style={[styles.panel, style]}>
      <BlueprintSpec opacity={0.28} grid={true} dimensions={true} specs={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    aspectRatio: 960 / 520,
    overflow: 'hidden',
  },
});
