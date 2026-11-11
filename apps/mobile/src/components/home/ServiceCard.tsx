import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale } from '@/components/ui';
import type { HomeService } from './serviceCatalog';
import { palette, radii, spacing, typography } from '@/theme';

export type ServiceCardVariant = 'primary' | 'urgent' | 'compact';

export type ServiceCardProps = {
  service: HomeService;
  variant: ServiceCardVariant;
  onPress: () => void;
  /** Hairline above a compact row (list separator). */
  divider?: boolean;
};

/**
 * One service tile in three weights:
 * primary (main offer), urgent (action pill), compact (secondary).
 * The urgent pill is visual only — the whole row is the touch target.
 */
export function ServiceCard({
  service,
  variant,
  onPress,
  divider = false,
}: ServiceCardProps) {
  const { Icon, label, detail, actionLabel } = service;

  if (variant === 'urgent') {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${detail}${actionLabel ? `. ${actionLabel}` : ''}`}
        scaleTo={0.99}
        style={styles.urgentRow}
      >
        <View style={styles.urgentIcon}>
          <Icon size={18} color={palette.accent} strokeWidth={1.9} />
        </View>
        <View style={styles.urgentText}>
          <Text style={styles.urgentTitle} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.urgentDetail} numberOfLines={2}>
            {detail}
          </Text>
        </View>
        {actionLabel ? (
          <View style={styles.actionPill}>
            <Text style={styles.actionText} numberOfLines={1}>
              {actionLabel}
            </Text>
          </View>
        ) : null}
      </PressableScale>
    );
  }

  if (variant === 'compact') {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${detail}`}
        scaleTo={0.99}
        style={[styles.compactRow, divider && styles.compactDivider]}
      >
        <View style={styles.compactIcon}>
          <Icon size={16} color={palette.textMuted} strokeWidth={1.8} />
        </View>
        <View style={styles.compactText}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.compactDetail} numberOfLines={2}>
            {detail}
          </Text>
        </View>
        <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      scaleTo={0.985}
      style={styles.primary}
    >
      <View style={styles.primaryIcon}>
        <Icon size={20} color={palette.textPrimary} strokeWidth={1.8} />
      </View>
      <View style={styles.primaryText}>
        <Text style={styles.primaryTitle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.primaryDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  primaryIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  primaryText: { flex: 1 },
  primaryTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  primaryDetail: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 2,
  },

  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  urgentIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoftBg,
  },
  urgentText: { flex: 1, minWidth: 0 },
  urgentTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  urgentDetail: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 2,
  },
  actionPill: {
    minHeight: 40,
    minWidth: 76,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  actionText: {
    ...typography.label,
    color: palette.onAccent,
    fontWeight: '600',
  },

  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  compactDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  compactIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  compactText: { flex: 1 },
  compactTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  compactDetail: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 1,
  },
});
