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
          style={styles.actionHit}
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
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  title: { ...typography.section, color: palette.textPrimary },
  spacer: { flex: 1 },
  // 44px tall tap area for the small "See all"-style link
  actionHit: { minHeight: 44, justifyContent: 'center' },
  action: { ...typography.captionMedium, color: palette.accent },
});

export default SectionHead;
