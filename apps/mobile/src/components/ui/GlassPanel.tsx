import { StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

/**
 * GlassPanel — frosted-glass surface.
 *
 * Uses translucent tint layers (no native blur — zero rebuild needed).
 * To upgrade to native blur later: install expo-blur, replace the
 * background View with <BlurView>, and rebuild via `npx expo run:ios`.
 *
 * To remove glassmorphism entirely: delete this file + revert the ~5
 * import sites. All glass routes through this one component.
 */

export interface GlassPanelProps {
  children: ReactNode;
  /** Blur intensity 0–100 (currently unused — reserved for native blur). */
  intensity?: number;
  /** Extra style for the outer container. */
  style?: ViewStyle | (ViewStyle | undefined)[];
  /** Border radius override. */
  radius?: number;
}

export function GlassPanel({
  children,
  intensity = 40,
  style,
  radius = 12,
}: GlassPanelProps) {
  // Higher intensity = more visible glass tint
  const bgAlpha = 0.06 + (intensity / 100) * 0.06;
  const borderAlpha = 0.14 + (intensity / 100) * 0.08;

  return (
    <View
      style={[
        styles.wrap,
        styles.layers,
        {
          borderRadius: radius,
          backgroundColor: `rgba(255, 255, 255, ${bgAlpha.toFixed(2)})`,
          borderColor: `rgba(255, 255, 255, ${borderAlpha.toFixed(2)})`,
        },
        style,
      ]}
    >
      {/* Dark scrim layer for depth */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  layers: {},
  scrim: {
    ...{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  content: {},
});
