import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale } from '@/components/ui';
import { SERVICE_LIST_ORDER, type ServiceCategory } from '../serviceRequestConfig';
import { palette } from '@/theme';

import { styles } from './wizardStyles';

export function ServiceChooserStep({ startService }: { startService: (category: ServiceCategory) => void }) {
  return (
        <View style={styles.services}>
          {SERVICE_LIST_ORDER.map((service, index) => (
            <PressableScale
              key={service.category}
              onPress={() => startService(service.category)}
              accessibilityRole="button"
              accessibilityLabel={service.label}
              scaleTo={0.99}
              style={[styles.serviceRow, index > 0 && styles.divider]}
            >
              <Text style={styles.serviceIndex}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={styles.serviceText}>
                <Text style={styles.serviceLabel}>{service.label}</Text>
                <Text style={styles.serviceDetail}>{service.detail}</Text>
              </View>
              <ChevronRight
                size={16}
                color={palette.textMuted}
                strokeWidth={1.8}
              />
            </PressableScale>
          ))}
        </View>
  );
}
