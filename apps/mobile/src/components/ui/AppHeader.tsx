import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing, typography } from '@/theme';

export interface AppHeaderProps {
  title?: string;
  /** Brand mark shown instead of the title text (centered). */
  logo?: ImageSourcePropType;
  /** Optional element rendered on the left (e.g. a back button). */
  left?: ReactNode;
  /** Optional element rendered on the right (e.g. an action). */
  right?: ReactNode;
  /** Optional subtitle / supporting line. */
  subtitle?: string;
  /** Chrome treatment. Dark navy header is the reference default. @default 'dark' */
  variant?: 'dark' | 'light';
}

/**
 * The one screen header: deep navy chrome bar above light content, matching
 * the approved reference. Back button and actions are passed in as nodes so
 * navigation behavior stays at the call site.
 */
export function AppHeader({
  title,
  logo,
  subtitle,
  left,
  right,
  variant = 'dark',
}: AppHeaderProps) {
  const dark = variant === 'dark';
  return (
    <View style={[styles.header, dark ? styles.headerDark : styles.headerLight]}>
      {/* Both side slots always render so the centered title stays centered. */}
      {left ? <View style={styles.side}>{left}</View> : <View style={styles.side} />}
      <View style={[styles.center, !!left && styles.centerLeft]}>
        {logo ? (
          <Image
            source={logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Weyro"
          />
        ) : (
          <Text
            style={[styles.title, dark ? styles.titleDark : styles.titleLight, !!left && styles.titleLeft]}
            numberOfLines={1}
            maxFontSizeMultiplier={2}
          >
            {title}
          </Text>
        )}
        {subtitle ? (
          <Text
            style={[styles.subtitle, dark ? styles.subtitleDark : styles.subtitleLight, !!left && styles.subtitleLeft]}
            numberOfLines={1}
            maxFontSizeMultiplier={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.side}>{right}</View> : <View style={styles.side} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  headerDark: {
    backgroundColor: palette.header,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLight: {
    backgroundColor: palette.surface,
    borderBottomColor: palette.border,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  centerLeft: {
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
  },
  titleDark: {
    color: palette.onHeader,
  },
  titleLight: {
    color: palette.textPrimary,
  },
  titleLeft: {
    textAlign: 'left',
  },
  logo: {
    height: 26,
    width: 93, // 26 * logo aspect ratio (715/200)
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 2,
  },
  subtitleDark: {
    color: palette.onHeaderMuted,
  },
  subtitleLight: {
    color: palette.textSecondary,
  },
  subtitleLeft: {
    textAlign: 'left',
  },
});

export default AppHeader;
