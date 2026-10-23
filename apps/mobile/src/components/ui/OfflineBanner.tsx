import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '@/theme';

export interface OfflineBannerProps {
  visible: boolean;
  message?: string;
}

/**
 * App-wide connectivity cue (visual only). Rendered conditionally; does not
 * alter any network logic. Uses warning tones with text so it is never
 * color-only.
 */
export function OfflineBanner({ visible, message = "You're offline" }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.dot} />
      <Text style={styles.text} maxFontSizeMultiplier={2}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.warningSoftBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.warning,
    marginRight: spacing.sm,
  },
  text: {
    ...typography.captionMedium,
    color: palette.warning,
  },
});

export default OfflineBanner;
