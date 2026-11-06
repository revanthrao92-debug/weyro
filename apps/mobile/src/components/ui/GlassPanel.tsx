import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { ReactNode } from 'react';

/**
 * GlassPanel — the reusable frosted-glass surface.
 *
 * Wraps expo-blur's BlurView with a hairline border and controlled tint.
 * Every glass surface in the app routes through this component — one file
 * controls the entire app's glassmorphism.
 *
 * Usage:
 *   <GlassPanel intensity={40} style={…}>{children}</GlassPanel>
 *
 * To remove glassmorphism from the entire app: delete this file + revert
 * the ~5 import sites. The `GlassPanel` is the only glass component.
 */

export interface GlassPanelProps {
  children: ReactNode;
  /** Blur intensity 0–100. Higher = more frosted. Default 40. */
  intensity?: number;
  /** Tint color for the blur layer. */
  tint?: BlurViewProps['tint'];
  /** Extra style for the outer container. */
  style?: ViewStyle | (ViewStyle | undefined)[];
  /** Border radius override. */
  radius?: number;
}

export function GlassPanel({
  children,
  intensity = 40,
  tint = 'dark',
  style,
  radius = 12,
}: GlassPanelProps) {
  return (
    <View
      style={[
        styles.wrap,
        { borderRadius: radius },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      {/* Hairline border overlay */}
      <View style={[StyleSheet.absoluteFill, styles.border, { borderRadius: radius }]} />
      {/* Content on top of the blur */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  content: {
    // Content renders above the blur layer
  },
});
