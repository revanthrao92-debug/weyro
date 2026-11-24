import { Text, View } from 'react-native';
import { PressableScale, SectionHead as Head } from '@/components/ui';

import type { useRouter } from 'expo-router';
import { styles } from './styles';
import { PACKAGES } from './shared';

export function PackagesSection({ router }: {
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Packages */}
      <Head title="Packages" />
      <View style={styles.index}>
        {PACKAGES.map((pkg, i) => (
          <PressableScale
            key={pkg.title}
            onPress={() =>
              router.push(
                `/requests/create?category=${pkg.category}&title=${encodeURIComponent(pkg.title)}`
              )
            }
            accessibilityRole="button"
            accessibilityLabel={pkg.title}
            scaleTo={0.99}
            style={[styles.indexRow, i > 0 && styles.rowDivider]}
          >
            <View style={styles.indexText}>
              <Text style={styles.indexLabel}>{pkg.title}</Text>
              <Text style={styles.indexDetail}>{pkg.detail}</Text>
            </View>
            <Text style={styles.packageCta}>Get quotes</Text>
          </PressableScale>
        ))}
      </View>
    </>
  );
}
