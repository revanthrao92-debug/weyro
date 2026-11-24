import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableScale, SectionHead as Head } from '@/components/ui';
import { palette } from '@/theme';
import { labelize } from '@/utils/format';

import type { useRouter } from 'expo-router';
import type { SparePart } from '@/hooks/useParts';
import { styles } from './styles';
import { PART_CATEGORIES } from './shared';

export function PartsRail({ router, parts }: {
  router: ReturnType<typeof useRouter>;
  parts: SparePart[];
}) {
  return (
    <>
      {/* Parts — always visible so the section rhythm never skips */}
      <Head
        title="Spare parts"
        action="Shop"
        onAction={() => router.push('/shop')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.rail}
      >
        {parts.length === 0 ? (
          PART_CATEGORIES.map((category) => (
            <PressableScale
              key={category.label}
              onPress={() => router.push('/shop')}
              accessibilityRole="button"
              accessibilityLabel={`${category.label} parts`}
              scaleTo={0.98}
              style={styles.railCard}
            >
              <View style={styles.railBody}>
                <category.Icon size={16} color={palette.textSecondary} strokeWidth={1.7} />
                <Text style={styles.railKicker}>Catalogue</Text>
                <Text style={styles.railTitle}>{category.label}</Text>
                <Text style={styles.railMeta}>{category.detail}</Text>
              </View>
            </PressableScale>
          ))
        ) : (
          parts.map((part) => (
            <PressableScale
              key={part.id}
              onPress={() => router.push(`/shop/${part.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Part ${part.name}`}
              scaleTo={0.98}
              style={styles.railCard}
            >
              {part.imageUrl ? (
                <Image
                  source={{ uri: part.imageUrl }}
                  style={styles.railImage}
                  contentFit="cover"
                  transition={120}
                />
              ) : null}
              <View style={styles.railBody}>
                <Text style={styles.railKicker}>{labelize(part.condition)}</Text>
                <Text style={styles.railTitle} numberOfLines={2}>
                  {part.name}
                </Text>
                <Text style={styles.railMeta}>{part.partNumber}</Text>
                <Text style={styles.railPrice}>
                  ₹{Number(part.price).toLocaleString('en-IN')}
                </Text>
              </View>
            </PressableScale>
          ))
        )}
      </ScrollView>
    </>
  );
}
