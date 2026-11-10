import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { palette, radii } from '@/theme';

/**
 * Metallic / lighting primitives.
 *
 * Static SVG gradients only — no per-frame cost, no blur, no heavy shadows.
 * Used to give surfaces and CTAs a machined edge instead of flat fills.
 */

export interface MetallicEdgeProps {
  /** Peak opacity at the centre of the edge. */
  opacity?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** 1px titanium sheen that fades to transparent at both ends. */
export function MetallicEdge({ opacity = 0.2, height = 1, style }: MetallicEdgeProps) {
  return (
    <View pointerEvents="none" style={[{ height, overflow: 'hidden' }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="weyroEdge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={palette.textPrimary} stopOpacity="0" />
            <Stop offset="0.5" stopColor={palette.textPrimary} stopOpacity={opacity} />
            <Stop offset="1" stopColor={palette.textPrimary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill="url(#weyroEdge)" />
      </Svg>
    </View>
  );
}

export interface RadialGlowProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

/** Soft ambient light. Place behind heroes/CTAs, never in front of text. */
export function RadialGlow({
  size = 280,
  color = palette.accent,
  opacity = 0.16,
  style,
}: RadialGlowProps) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="weyroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.6" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#weyroGlow)" />
      </Svg>
    </View>
  );
}

export interface BottomFadeProps {
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Vertical fade from transparent to the canvas — cinematic image edge. */
export function BottomFade({ height = 160, color = palette.canvas, style }: BottomFadeProps) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height }, style]}
    >
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="weyroFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.55" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill="url(#weyroFade)" />
      </Svg>
    </View>
  );
}

export interface SurfaceProps {
  children: ReactNode;
  /** 'elevated' = raised card, 'deep' = inset well. */
  tone?: 'elevated' | 'deep';
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one metallic surface: graphite fill, titanium hairline, lighter top edge.
 * Replaces flat coloured rectangles without adding shadows.
 */
export function Surface({ children, tone = 'elevated', radius = radii.md, style }: SurfaceProps) {
  return (
    <View
      style={[
        styles.surface,
        { borderRadius: radius },
        tone === 'deep' ? styles.deep : styles.elevated,
        style,
      ]}
    >
      <MetallicEdge style={styles.topEdge} opacity={0.22} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: palette.surface,
  },
  deep: {
    backgroundColor: palette.surfaceAlt,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
