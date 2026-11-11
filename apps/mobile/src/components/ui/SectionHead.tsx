import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { PressableScale } from './Motion';
import { palette, spacing, typography, fontFamilyMono } from '@/theme';

export interface SectionHeadProps {
  /** Small index/label, e.g. "03" or "P1". */
  index?: string;
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Job-sheet section header: mono index, title, optional link. */
export function SectionHead({ index, title, action, onAction, style }: SectionHeadProps) {
  return (
    <View style={[styles.head, style]}>
      {index ? <Text style={styles.index}>{index}</Text> : null}
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
  index: { fontFamily: fontFamilyMono, fontSize: 11, color: palette.textMuted },
  title: { ...typography.captionMedium, color: palette.textPrimary },
  spacer: { flex: 1 },
  action: { ...typography.label, color: palette.textSecondary },
});

export default SectionHead;
