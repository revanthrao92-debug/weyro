import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radii, spacing, typography } from '@/theme';

/**
 * AdBanner — the ONE component that renders every ad slot in the app.
 *
 * Usage: `{showAds ? <AdBanner placement="home-hero-bottom" /> : null}`
 *
 * To change ad content, frequency or styling app-wide, edit only this file.
 * `slots` maps a placement id to static demo content — replace `resolve`
 * with your ad SDK / API integration when ready (single edit point).
 *
 * Height constants below define the extra ad space in the layout; screens
 * reserve space rather than squeezing content.
 */

export type AdPlacement =
  | 'home-hero-bottom'
  | 'home-section'
  | 'shop-hero'
  | 'shop-section'
  | 'feed-inline';

type AdContent = {
  headline: string;
  subtext: string;
  imageUrl?: string;
  cta: string;
};

const PLACEHOLDER_ADS: Record<AdPlacement, AdContent> = {
  'home-hero-bottom': {
    headline: 'Genuine Parts. Better Rides.',
    subtext: 'Original parts from trusted dealers.',
    cta: 'Shop Now',
    imageUrl: undefined,
  },
  'home-section': {
    headline: 'Monsoon Service Camp',
    subtext: 'Flat 20% off at approved garages.',
    cta: 'View',
  },
  'shop-hero': {
    headline: 'Need a rare part?',
    subtext: 'Upload a photo and get quotes from multiple dealers.',
    cta: 'Upload Photo',
  },
  'shop-section': {
    headline: 'Top Deals this week',
    subtext: 'Up to 15% off brake & filter kits.',
    cta: 'Explore',
  },
  'feed-inline': {
    headline: 'Towgram — 24/7 towing',
    subtext: 'Nationwide assistance in 30 min.',
    cta: 'Learn More',
  },
};

/** Resolve an impression. Swap this for a real ad SDK later. */
function resolve(placement: AdPlacement): AdContent {
  return PLACEHOLDER_ADS[placement];
}

function onPressAd(placement: AdPlacement, cta: string) {
  // TODO: route to ad target / track impression.
  void placement;
  void cta;
}

export interface AdBannerProps {
  placement: AdPlacement;
  /** Hide programmatically (e.g. when the user is a paying subscriber). */
  visible?: boolean;
}

export function AdBanner({ placement, visible = true }: AdBannerProps) {
  if (!visible) return null;
  const ad = resolve(placement);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ad: ${ad.headline}`}
      onPress={() => onPressAd(placement, ad.cta)}
      style={({ pressed }) => [
        styles.wrap,
        pressed && { opacity: 0.95 },
      ]}
    >
      {ad.imageUrl ? (
        <Image source={{ uri: ad.imageUrl }} style={styles.image} />
      ) : null}
      <View style={styles.scrim}>
        <View style={styles.textCol}>
          <View style={styles.sponsoredRow}>
            <Text style={styles.sponsored}>Sponsored</Text>
          </View>
          <Text style={styles.headline} numberOfLines={1}>
            {ad.headline}
          </Text>
          <Text style={styles.subtext} numberOfLines={2}>
            {ad.subtext}
          </Text>
        </View>
        <View style={styles.ctaPill}>
          <Text style={styles.ctaText}>{ad.cta}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
    height: 96, // generous reserved ad space
    backgroundColor: palette.header,
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    resizeMode: 'cover',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(3, 25, 35, 0.82)',
    paddingHorizontal: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  sponsoredRow: { marginBottom: spacing.xs },
  sponsored: {
    ...typography.label,
    color: palette.onHeaderMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headline: {
    ...typography.heading,
    color: palette.onHeader,
  },
  subtext: {
    ...typography.caption,
    color: palette.onHeaderMuted,
  },
  ctaPill: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ctaText: {
    ...typography.captionMedium,
    color: palette.onAccent,
  },
});
