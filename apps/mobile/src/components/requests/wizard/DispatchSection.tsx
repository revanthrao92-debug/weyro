import { Text, View } from 'react-native';
import { Chip, SectionHead } from '@/components/ui';
import { urgencyLabel, type ServiceConfig, type Urgency } from '../serviceRequestConfig';

import { styles } from './wizardStyles';

export function DispatchSection({ config, urgency, setUrgency, setFormError }: {
  config: ServiceConfig;
  urgency: Urgency;
  setUrgency: (urgency: Urgency) => void;
  setFormError: (message: string | null) => void;
}) {
  if (config.urgencyMode !== 'select') return null;
  return (
    <>
      <SectionHead title="Dispatch" />
      <Text style={styles.fieldLabel}>Urgency</Text>
      <View style={styles.chipWrap}>
        {(['NORMAL', 'URGENT', 'EMERGENCY'] as Urgency[]).map((option) => (
          <Chip
            key={option}
            label={urgencyLabel(option)}
            selected={urgency === option}
            onPress={() => {
              setUrgency(option);
              setFormError(null);
            }}
          />
        ))}
      </View>
    </>
  );
}
