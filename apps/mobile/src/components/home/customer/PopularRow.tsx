import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ClipboardCheck, Package } from 'lucide-react-native';
import type { useRouter } from 'expo-router';
import { PressableScale, SectionHead } from '@/components/ui';
import { palette, radii, spacing, typography } from '@/theme';
import { PACKAGES } from './shared';
import { formatRupees } from '@/utils/format';

const CARD_W = 220;

type Item =
  | { kind: 'package'; key: string; title: string; detail: string; go: string }
  | { kind: 'part'; key: string; title: string; detail: string; go: string; imageUrl?: string | null };

/** One swipeable row for "things you can buy": service packages, then shop parts. */
export function PopularRow({ router, parts }: {
  router: ReturnType<typeof useRouter>;
  parts: { id: string; name: string; price: number | string; imageUrl?: string | null }[];
}) {
  const items: Item[] = [
    ...PACKAGES.map((pkg) => ({
      kind: 'package' as const,
      key: `pkg-${pkg.title}`,
      title: pkg.title,
      detail: pkg.detail,
      go: `/requests/create?category=${pkg.category}&title=${encodeURIComponent(pkg.title)}`,
    })),
    ...parts.map((part) => ({
      kind: 'part' as const,
      key: part.id,
      title: part.name,
      detail: formatRupees(part.price),
      go: `/shop/${part.id}`,
      imageUrl: part.imageUrl,
    })),
  ];

  return (
    <View>
      <SectionHead title="Popular packages" action="Shop" onAction={() => router.push('/shop')} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push(item.go as never)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.detail}`}
            scaleTo={0.97}
            style={styles.card}
          >
            {item.kind === 'part' && item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbIcon]}>
                {item.kind === 'package' ? (
                  <ClipboardCheck size={26} color={palette.accent} strokeWidth={1.7} />
                ) : (
                  <Package size={26} color={palette.accent} strokeWidth={1.7} />
                )}
              </View>
            )}
            <Text style={styles.kind}>{item.kind === 'package' ? 'Service package' : 'Spare part'}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {item.detail}
            </Text>
          </PressableScale>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md, paddingRight: spacing.lg },
  card: {
    width: CARD_W,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  thumb: { height: 96, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  kind: { ...typography.label, color: palette.textMuted, marginTop: spacing.md },
  title: { ...typography.bodyMedium, color: palette.textPrimary, marginTop: 2 },
  detail: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
});
