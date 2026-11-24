import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { PressableScale } from '@/components/ui';

import type { useRouter } from 'expo-router';
import { styles } from './styles';
import { FOOTER_LINKS } from './shared';

export function Footer({ router }: {
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Footer — brand, real links, support, version */}
      <View style={styles.footer}>
        <View style={styles.footerBrandRow}>
          <Text style={styles.footerWordmark}>weyro</Text>
          <View style={styles.footerMark} />
        </View>
        <Text style={styles.footerTagline}>
          Vehicle service and parts, from verified garages.
        </Text>

        <View style={styles.footerLinks}>
          {FOOTER_LINKS.map((link) => (
            <PressableScale
              key={link.label}
              onPress={() => router.push(link.route)}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              scaleTo={0.96}
              style={styles.footerLinkCell}
            >
              <Text style={styles.footerLink}>{link.label}</Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.footerSupport}>
          <Text style={styles.footerSupportLabel}>Support</Text>
          <PressableScale
            onPress={() => Linking.openURL('mailto:support@weyro.app')}
            accessibilityRole="link"
            accessibilityLabel="Email Weyro support"
            scaleTo={0.98}
          >
            <Text style={styles.footerSupportLink}>support@weyro.app</Text>
          </PressableScale>
        </View>

        <View style={styles.footerBottom}>
          <Text style={styles.footerMeta}>© 2026 Weyro</Text>
          <Text style={styles.footerMeta}>
            v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </View>
    </>
  );
}
