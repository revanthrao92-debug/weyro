import { Text, View } from 'react-native';
import { Chip, PressableScale, SectionHead } from '@/components/ui';
import { urgencyLabel, type ServiceConfig, type Urgency } from '../serviceRequestConfig';

import type { Dispatch, SetStateAction } from 'react';
import { styles } from './wizardStyles';

export function DispatchSection({ config, urgency, setUrgency, setFormError, isBroadcast, setIsBroadcast }: {
  config: ServiceConfig;
  urgency: Urgency;
  setUrgency: (urgency: Urgency) => void;
  setFormError: (message: string | null) => void;
  isBroadcast: boolean;
  setIsBroadcast: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      <SectionHead title="Dispatch" />
      {config.urgencyMode === 'select' ? (
        <>
          <Text style={styles.fieldLabel}>Urgency</Text>
          <View style={styles.chipWrap}>
            {(['NORMAL', 'URGENT', 'EMERGENCY'] as Urgency[]).map(
              (option) => (
                <Chip
                  key={option}
                  label={urgencyLabel(option)}
                  selected={urgency === option}
                  onPress={() => {
                    setUrgency(option);
                    setFormError(null);
                  }}
                />
              ),
            )}
          </View>
        </>
      ) : null}
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>
            Broadcast to nearby providers
          </Text>
          <Text style={styles.help}>
            {isBroadcast
              ? 'Nearby verified providers can send quotes.'
              : 'Only providers you contact directly will see it.'}
          </Text>
        </View>
        <PressableScale
          onPress={() => setIsBroadcast((current) => !current)}
          accessibilityRole="switch"
          accessibilityState={{ checked: isBroadcast }}
          accessibilityLabel="Broadcast to nearby providers"
          scaleTo={0.95}
          style={[styles.toggle, isBroadcast && styles.toggleActive]}
        >
          <Text
            style={[
              styles.toggleValue,
              isBroadcast && styles.toggleValueActive,
            ]}
          >
            {isBroadcast ? 'On' : 'Off'}
          </Text>
        </PressableScale>
      </View>
    </>
  );
}
