import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { PressableScale } from '@/components/ui';

import { styles } from './styles';

export function Footer() {
  return (
    <>
      {/* Footer — support and version (navigation lives in the tab bar) */}
      <View style={styles.footer}>
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
