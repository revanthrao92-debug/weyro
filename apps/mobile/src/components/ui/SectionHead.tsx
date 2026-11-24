import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { PressableScale } from './Motion';
import { palette, spacing, typography } from '@/theme';

export interface SectionHeadProps {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Section header: title with an optional link. */
export function SectionHead({ title, action, onAction, style }: SectionHeadProps) {
  return (
    <View style={[styles.head, style]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
      {action ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole="link"
          accessibilityLabel={action}
          scaleTo={0.95}
        >
          <Text style={styles.action}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: { ...typography.captionMedium, color: palette.textPrimary },
  spacer: { flex: 1 },
  action: { ...typography.label, color: palette.textSecondary },
});

export default SectionHead;
