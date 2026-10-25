import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, radii, typography } from '@/theme';

export interface PromoBannerProps {
  /** Landscape promotional image. */
  image: string | number;
  /** Headline text. */
  headline: string;
  /** Supporting copy. */
  subhead: string;
  /** Optional CTA label. */
  ctaLabel?: string;
  /** Optional CTA action. */
  onPress?: () => void;
  /** Destination route (used when onPress omitted). */
  href?: string;
  /** Small sponsor label. */
  sponsorLabel?: string;
  /** Whether this placement is paid (renders "Sponsored" tag). */
  sponsored?: boolean;
  /** When no ad inventory exists, show placeholder or null. */
  visible?: boolean;
}

export function PromoBanner({
  image,
  headline,
  subhead,
  ctaLabel,
  onPress,
  href,
  sponsorLabel,
  sponsored = false,
  visible = true,
}: PromoBannerProps) {
  if (!visible) return null;

  const handlePress = () => {
    if (onPress) onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={headline}
      style={styles.container}
    >
      <Image
        source={(
          typeof image === 'number' ? image : { uri: image }
        ) as any}
        style={styles.image}
      />
      <View style={styles.overlay}>
        {sponsored && (
          <View style={styles.sponsorChip}>
            <Text style={styles.sponsorText}>Sponsored</Text>
          </View>
        )}
        {sponsorLabel && (
          <View style={styles.sponsorChip}>
            <Text style={styles.sponsorText}>{sponsorLabel}</Text>
          </View>
        )}
        <View style={styles.textWrap}>
          <Text style={styles.headline} maxFontSizeMultiplier={2}>
            {headline}
          </Text>
          <Text style={styles.subhead} maxFontSizeMultiplier={2}>
            {subhead}
          </Text>
          {ctaLabel ? (
            <Pressable
              onPress={handlePress}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 140,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
    marginHorizontal: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  sponsorChip: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(5, 7, 9, 0.6)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  sponsorText: {
    ...typography.label,
    color: palette.textMuted,
  },
  textWrap: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headline: {
    ...typography.heading,
    color: palette.textPrimary,
  },
  subhead: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  ctaText: {
    ...typography.label,
    color: palette.onAccent,
    fontWeight: '600',
  },
});

export default PromoBanner;
