import { Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { ChevronRight, MapPin, Siren } from 'lucide-react-native';
import { PressableScale, Pulse } from '@/components/ui';
import { palette, radii } from '@/theme';

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
        <Pulse radius={radii.md}>
        <PressableScale
          onPress={() => {
            haptics.heavy();
            router.push('/sos');
          }}
          accessibilityRole="button"
          accessibilityLabel="SOS, roadside help"
          scaleTo={0.95}
          hitSlop={8}
          style={styles.sosButton}
        >
          <Siren size={14} color={palette.accent} strokeWidth={2} />
          <Text style={styles.sos}>SOS</Text>
        </PressableScale>
        </Pulse>
      </View>
    </>
  );
}
