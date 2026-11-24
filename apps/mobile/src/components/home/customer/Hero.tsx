import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ArrowRight } from 'lucide-react-native';
import { PressableScale, SideFade } from '@/components/ui';
import { palette } from '@/theme';

import type { useRouter } from 'expo-router';
import { styles } from './styles';
import { HERO_IMAGE } from './shared';

export function Hero({ router }: {
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Hero */}
      <View style={styles.hero}>
        <Image
          source={HERO_IMAGE}
          style={styles.heroImage}
          contentFit="cover"
          contentPosition="center"
          transition={200}
        />
        <View style={styles.heroScrim} />
        <SideFade reach={0.72} opacity={0.86} />
        <View style={styles.heroContent}>
          <Text style={styles.heroMeta}>Verified garages · protected payments</Text>
          <Text style={styles.heroTitle}>Service, parts,{'\n'}roadside.</Text>
          <Text style={styles.heroSub}>
            Post one request. Compare quotes from verified garages near you.
          </Text>
          <View style={styles.heroActions}>
            <PressableScale
              onPress={() => router.push('/requests/create')}
              accessibilityRole="button"
              accessibilityLabel="Post a request"
              scaleTo={0.97}
              style={styles.primaryCta}
            >
              <Text style={styles.primaryCtaText}>Post a request</Text>
              <ArrowRight size={16} color={palette.onAccent} strokeWidth={2.2} />
            </PressableScale>
            <PressableScale
              onPress={() => router.push('/shop')}
              accessibilityRole="button"
              accessibilityLabel="Browse parts"
              scaleTo={0.97}
              style={styles.secondaryCta}
            >
              <Text style={styles.secondaryCtaText}>Browse parts</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </>
  );
}
