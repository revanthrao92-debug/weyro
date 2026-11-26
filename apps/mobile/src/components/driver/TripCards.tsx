import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Button, PressableScale, StatusPill } from '@/components/ui';
import {
  useAcceptDriverJob,
  useDeclineDriverJob,
  useUpdateDriverJobStatus,
  type DriverJob,
} from '@/hooks/useDriverGo';
import { haptics } from '@/lib/haptics';
import { confirmAction } from '@/lib/confirm';
import { palette, radii, spacing, typography } from '@/theme';
import {
  customerName,
  durationLabel,
  jobStatusLabel,
  jobStatusTone,
  jobWhen,
  money,
  nextTripStep,
  vehicleLabel,
} from './driverFormat';

/** Trip cards shared by the driver Dashboard, Jobs and Earnings screens. */

function TripSummary({ job }: { job: DriverJob }) {
  return (
    <>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {job.pickupAddress}
        </Text>
        <View style={styles.earn}>
          <Text style={styles.amount}>{money(job.driverEarning)}</Text>
          <Text style={styles.earnLabel}>You earn</Text>
        </View>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {[customerName(job), job.vehicle ? vehicleLabel(job) : null].filter(Boolean).join(', ')}
      </Text>
      <Text style={styles.meta}>
        {jobWhen(job.startAt)}, {durationLabel(job)}
      </Text>
    </>
  );
}

/** A new request: accept or decline right here. */
export function TripRequestCard({ job, onOpen }: { job: DriverJob; onOpen: () => void }) {
  const accept = useAcceptDriverJob();
  const decline = useDeclineDriverJob();
  const busy = accept.isPending || decline.isPending;
  const onAccept = async () => {
    try {
      await accept.mutateAsync(job.id);
      haptics.success();
    } catch {
      // The screen refreshes; the trip may have been taken or cancelled.
    }
  };
  const onDecline = async () => {
    if (!(await confirmAction('Decline this trip?', 'The customer will look for another driver.', 'Decline'))) return;
    await decline.mutateAsync({ id: job.id }).catch(() => undefined);
  };
  return (
    <View style={styles.card}>
      <PressableScale onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open trip request: ${job.pickupAddress}`} scaleTo={0.99}>
        <TripSummary job={job} />
        <View style={styles.pills}>
          <StatusPill label="New request" tone="warning" />
        </View>
      </PressableScale>
      <View style={styles.actions}>
        <Button title="Decline" variant="secondary" disabled={busy} onPress={() => void onDecline()} style={styles.half} />
        <Button title="Accept" loading={accept.isPending} disabled={busy} onPress={() => void onAccept()} style={styles.half} />
      </View>
    </View>
  );
}

/** An upcoming or running trip with its next step as one button. */
export function TripToDoCard({ job, onOpen }: { job: DriverJob; onOpen: () => void }) {
  const update = useUpdateDriverJobStatus();
  const step = nextTripStep(job.status);
  const act = async () => {
    // Starting needs the customer's code and ending a confirmation: done on the trip screen.
    if (!step?.next) return onOpen();
    try {
      await update.mutateAsync({ id: job.id, status: step.next });
      haptics.success();
    } catch {
      // The trip screen shows the reason if it can't move.
    }
  };
  return (
    <View style={styles.card}>
      <PressableScale onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open trip: ${job.pickupAddress}, ${jobStatusLabel(job.status)}`} scaleTo={0.99}>
        <TripSummary job={job} />
        <View style={styles.pills}>
          <StatusPill label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
        </View>
      </PressableScale>
      {step ? <Button title={step.title} loading={update.isPending} onPress={() => void act()} style={styles.button} /> : null}
    </View>
  );
}

/** A finished trip in a list. */
export function TripRow({ job, onPress }: { job: DriverJob; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.pickupAddress}, ${money(job.driverEarning)}, ${jobStatusLabel(job.status)}`}
      scaleTo={0.99}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {job.pickupAddress}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {customerName(job)}, {durationLabel(job)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>{money(job.driverEarning)}</Text>
        <StatusPill label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  title: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  earn: { alignItems: 'flex-end' },
  earnLabel: { ...typography.caption, color: palette.textMuted },
  amount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  meta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  pills: { flexDirection: 'row', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  half: { flex: 1 },
  button: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  rowRight: { alignItems: 'flex-end', gap: 4 },
});
