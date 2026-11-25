import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { PressableScale } from './Motion';
import { palette, spacing, typography } from '@/theme';

/**
 * A title + one-line explanation with an on/off switch. The whole row is the tap target
 * (a bare switch is smaller than 44px); the switch itself is only the picture of the state.
 */
export function SwitchRow({
  title,
  detail,
  value,
  onToggle,
  busy = false,
  disabled = false,
  accessibilityLabel,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onToggle: () => void;
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      onPress={onToggle}
      disabled={busy || disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: busy || disabled, busy }}
      accessibilityLabel={accessibilityLabel ?? title}
      scaleTo={0.99}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator color={palette.accent} />
      ) : (
        <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch
            value={value}
            trackColor={{ true: palette.accent, false: palette.borderStrong }}
            thumbColor="#FFFFFF"
            // web-only prop (react-native-web defaults it to teal), missing from the RN types
            {...({ activeThumbColor: '#FFFFFF' } as object)}
          />
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  text: { flex: 1 },
  title: { ...typography.bodyMedium, color: palette.textPrimary },
  detail: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
});
