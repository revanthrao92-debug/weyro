import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useUpdateBookingStatus, type Booking } from '@/hooks/useBookings';
import { haptics } from '@/lib/haptics';
import { Button, PressableScale, StatusPill } from '@/components/ui';
import { palette, radii, spacing, typography } from '@/theme';
import { bookingStatusTone, formatRupees, titleize } from '@/utils/format';
import { nextJobStep } from '@/utils/jobSteps';

/** Cards for jobs from accepted quotes: the Jobs tab (garages) and Orders (dealers). */

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DONE_LABEL: Record<string, string> = { COMPLETED: 'Completed', CANCELLED: 'Cancelled', DISPUTED: 'Disputed' };

const customerName = (b: Booking) =>
  b.customer ? `${b.customer.firstName} ${b.customer.lastName ?? ''}`.trim() : 'Customer';
const carName = (b: Booking) => {
  const v = b.quotation?.request?.vehicle;
  return v ? [v.make, v.model, v.year].filter(Boolean).join(' ') : null;
};

/** "Today 4:00 pm" / "Fri, 28 Nov, 10:00 am" for when the job is booked. */
function whenLabel(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, new Date())) return `Today ${time}`;
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function ToDoCard({ job, onOpen }: { job: Booking; onOpen: () => void }) {
  const update = useUpdateBookingStatus();
  const step = nextJobStep(job);
  const request = job.quotation?.request;
  const car = carName(job);
  const when = whenLabel(job.scheduledAt);
  const act = async () => {
    // Completing needs a confirmation and notes: that lives on the job screen.
    if (!step?.next) return onOpen();
    try {
      await update.mutateAsync({ id: job.id, status: step.next });
      haptics.success();
    } catch {
      // The hook already shows what went wrong.
    }
  };
  return (
    <View style={styles.todo}>
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open job: ${request?.title ?? 'Job'}, ${step?.label ?? ''}`}
        scaleTo={0.99}
      >
        <View style={styles.todoTop}>
          <Text style={styles.todoTitle} numberOfLines={2}>
            {request?.title ?? 'Service job'}
          </Text>
          <Text style={styles.amount}>{formatRupees(job.quotation?.totalCost ?? 0)}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[customerName(job), car].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {request?.category === 'TOWING' && request.dropoffAddress
            ? `${request.address} to ${request.dropoffAddress}`
            : request?.address ?? 'At the workshop'}
        </Text>
        <View style={styles.todoPills}>
          {step ? <StatusPill label={step.label} tone={job.status === 'IN_PROGRESS' ? 'warning' : 'info'} /> : null}
          {when ? <Text style={styles.when}>{when}</Text> : null}
        </View>
      </PressableScale>
      {step ? <Button title={step.title} loading={update.isPending} onPress={() => void act()} style={styles.todoButton} /> : null}
    </View>
  );
}

export function JobRow({ job, onPress }: { job: Booking; onPress: () => void }) {
  const request = job.quotation?.request;
  const status = DONE_LABEL[job.status] ?? titleize(job.status);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${request?.title ?? 'Job'}, ${formatRupees(job.quotation?.totalCost ?? 0)}, ${status}`}
      scaleTo={0.99}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {request?.title ?? 'Service job'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[customerName(job), carName(job)].filter(Boolean).join(', ')}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>{formatRupees(job.quotation?.totalCost ?? 0)}</Text>
        <StatusPill label={status} tone={bookingStatusTone(job.status)} />
      </View>
      <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
    </PressableScale>
  );
}


const styles = StyleSheet.create({
  todo: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  todoTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  todoTitle: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  todoPills: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  todoButton: { marginTop: spacing.md },
  when: { ...typography.captionMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  amount: { ...typography.bodyMedium, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  rowRight: { alignItems: 'flex-end', gap: 4 },
});
