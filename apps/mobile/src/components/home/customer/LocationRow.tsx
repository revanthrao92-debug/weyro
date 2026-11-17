import { Text, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { PressableScale } from '@/components/ui';
import { palette } from '@/theme';

import type { useRouter } from 'expo-router';
import type { SavedAddress } from '@/hooks/useProfile';
import { styles } from './styles';

export function LocationRow({ router, address, setLocationOpen }: {
  router: ReturnType<typeof useRouter>;
  address: SavedAddress | undefined;
  setLocationOpen: (open: boolean) => void;
}) {
  return (
    <>
      {/* Location + search */}
      <View style={styles.locationRow}>
        <PressableScale
          onPress={() => setLocationOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change location"
          scaleTo={0.98}
          style={styles.locationPress}
        >
          <MapPin size={14} color={palette.textMuted} strokeWidth={1.8} />
          <Text style={styles.locationText} numberOfLines={1}>
            {address?.title || address?.address || 'Set your location'}
          </Text>
          <ChevronRight size={14} color={palette.textMuted} strokeWidth={1.8} />
        </PressableScale>
        <PressableScale
          onPress={() => router.push('/sos')}
          accessibilityRole="button"
          accessibilityLabel="Roadside help"
          scaleTo={0.95}
        >
          <Text style={styles.sos}>SOS</Text>
        </PressableScale>
      </View>
    </>
  );
}
