import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Clock } from 'lucide-react-native';
import { PressableScale, StatusPill } from '@/components/ui';
import type { DriverJob } from '@/hooks/useDriverGo';
import {
  customerName,
  durationLabel,
  jobStatusLabel,
  jobStatusTone,
  jobWhen,
  money,
  vehicleLabel,
} from './driverFormat';
import { fontFamilyMono, palette, radii, spacing, typography } from '@/theme';

export function DriverJobCard({
  job,
  onPress,
}: {
  job: DriverJob;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${jobStatusLabel(job.status)} job, ${customerName(job)}, ${jobWhen(job.startAt)}`}
      scaleTo={0.99}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.when}>
          <Clock size={13} color={palette.textMuted} strokeWidth={1.8} />
          <Text style={styles.whenText}>{jobWhen(job.startAt)}</Text>
        </View>
        <StatusPill
          label={jobStatusLabel(job.status)}
          tone={jobStatusTone(job.status)}
        />
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {customerName(job)}
      </Text>
      <Text style={styles.vehicle} numberOfLines={1}>
        {vehicleLabel(job)}
      </Text>

      <View style={styles.bottom}>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>
            {durationLabel(job)} · {job.engagement === 'DAILY' ? 'Daily' : 'Hourly'}
          </Text>
          <Text style={styles.pickup} numberOfLines={1}>
            {job.pickupAddress}
          </Text>
        </View>
        <View style={styles.earning}>
          <Text style={styles.earningValue}>{money(job.driverEarning)}</Text>
          <Text style={styles.earningLabel}>you earn</Text>
        </View>
        <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  when: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  whenText: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  title: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    marginTop: spacing.sm,
  },
  vehicle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 1,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  meta: { flex: 1, minWidth: 0 },
  metaLabel: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
  pickup: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  earning: { alignItems: 'flex-end' },
  earningValue: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  earningLabel: {
    fontFamily: fontFamilyMono,
    fontSize: 8,
    color: palette.textMuted,
  },
});
