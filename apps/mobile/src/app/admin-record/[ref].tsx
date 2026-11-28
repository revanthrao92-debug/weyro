import { useRef } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail, MapPin, Phone } from 'lucide-react-native';
import { Button, Chip, ErrorState, PageHeader, PressableScale, ScreenContainer, SectionHead, Skeleton, StatusPill } from '@/components/ui';
import { MapSurface } from '@/maps';
import { hasMapAccess } from '@/maps/config';
import { useAdminRecord, useAdminRefundBooking, useAdminRefundOrder, type AdminRecord } from '@/hooks/useAdmin';
import { useUpdateBookingStatus } from '@/hooks/useBookings';
import { useNow } from '@/hooks/useNow';
import { useRefreshControl } from '@/hooks/useRefreshControl';
import { confirmAction, notice } from '@/lib/confirm';
import { palette, radii, spacing, typography, type StatusTone } from '@/theme';
import { formatRupees, titleize } from '@/utils/format';

const PROBLEM = ['CANCELLED', 'DISPUTED', 'FAILED', 'EXPIRED', 'REFUNDED', 'REJECTED', 'WITHDRAWN'];
const DONE = ['COMPLETED', 'PAID', 'CAPTURED', 'RELEASED', 'PROCESSED', 'ACCEPTED', 'DELIVERED'];
const tone = (status: string): StatusTone => (PROBLEM.includes(status) ? 'danger' : DONE.includes(status) ? 'success' : 'warning');

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `${Math.round(hours / 24)} days ago`;
}

/** Admin: everything about one record, found by its reference number, with live tracking. */
export default function AdminRecordScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  const query = useAdminRecord(ref);
  const refreshControl = useRefreshControl(query.refetch);

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        {query.isLoading ? (
          <>
            <PageHeader back title="Loading" />
            <Skeleton width="100%" height={110} />
            <Skeleton width="100%" height={220} style={{ marginTop: spacing.md }} />
          </>
        ) : query.isError || !query.data ? (
          <>
            <PageHeader back title={ref ?? 'Record'} />
            <ErrorState
              title="Could not open this record"
              message={(query.error as Error | null)?.message ?? 'Check your connection and try again.'}
              onRetry={() => void query.refetch()}
            />
          </>
        ) : (
          <Detail record={query.data} onOpen={(r) => router.push(`/admin-record/${r}`)} refetch={query.refetch} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Detail({ record: r, onOpen, refetch }: { record: AdminRecord; onOpen: (ref: string) => void; refetch: () => Promise<unknown> }) {
  const now = useNow();
  const refundOrder = useAdminRefundOrder();
  const refundBooking = useAdminRefundBooking();
  const updateJob = useUpdateBookingStatus();
  const busy = useRef(false);

  const refund = async () => {
    const action = r.actions.refund;
    if (!action || busy.current) return;
    busy.current = true;
    try {
      const ok = await confirmAction(
        `Refund ${formatRupees(action.amount)}?`,
        `${r.label} ${r.ref}, ${r.title}. The customer gets the money back on their original payment method. This can't be undone.`,
        'Refund',
      );
      if (!ok) return;
      await (action.kind === 'order' ? refundOrder : refundBooking).mutateAsync(action.id);
      notice('Refund started', `${formatRupees(action.amount)} is on its way back to the customer.`);
      await refetch();
    } catch (e: any) {
      notice('Refund failed', e?.message || 'Check your connection and try again.');
    } finally {
      busy.current = false;
    }
  };

  const JOB_STEP: Record<string, { title: string; ask: string; button: string }> = {
    COMPLETED: { title: 'Mark the job complete?', ask: 'The issue is closed and the provider can be paid.', button: 'Mark complete' },
    CANCELLED: { title: 'Cancel this job?', ask: 'The job stops. Refund the payment separately if one was made.', button: 'Cancel job' },
    DISPUTED: { title: 'Flag a dispute?', ask: 'Payment to the provider is held until you resolve it.', button: 'Flag dispute' },
  };
  const jobSteps =
    r.actions.jobStatus === 'DISPUTED'
      ? ['COMPLETED', 'CANCELLED']
      : ['IN_PROGRESS', 'COMPLETED'].includes(r.actions.jobStatus ?? '')
        ? ['DISPUTED']
        : [];
  const changeJob = async (status: string) => {
    const step = JOB_STEP[status];
    if (!r.actions.jobId || !(await confirmAction(step.title, step.ask, step.button))) return;
    try {
      await updateJob.mutateAsync({ id: r.actions.jobId, status });
      await refetch();
    } catch (e: any) {
      notice('Could not update the job', e?.message || 'Check your connection and try again.');
    }
  };

  return (
    <>
      <PageHeader back title={r.title}>
        <View style={styles.headMeta}>
          <StatusPill label={titleize(r.status)} tone={tone(r.status)} />
          <Text style={styles.meta} selectable>
            {r.label} {r.ref}
          </Text>
        </View>
      </PageHeader>

      <View style={styles.card}>
        {r.amount !== null ? <Text style={styles.amount}>{formatRupees(r.amount)}</Text> : null}
        <Text style={styles.meta}>Created {when(r.createdAt)}</Text>
        {r.actions.refund || jobSteps.length ? (
          <View style={styles.actions}>
            {r.actions.refund ? (
              <Button
                title="Refund"
                variant="destructive"
                loading={refundOrder.isPending || refundBooking.isPending}
                onPress={() => void refund()}
                style={styles.action}
              />
            ) : null}
            {jobSteps.map((s) => (
              <Button
                key={s}
                title={JOB_STEP[s].button}
                variant={s === 'COMPLETED' ? 'primary' : 'secondary'}
                loading={updateJob.isPending && updateJob.variables?.status === s}
                onPress={() => void changeJob(s)}
                style={styles.action}
              />
            ))}
          </View>
        ) : null}
      </View>

      {r.location ? (
        <>
          <SectionHead title="Where they are now" />
          <View style={styles.mapCard}>
            {/* Without a map key, skip the tile preview (its placeholder is written for customers) and keep the link. */}
            {hasMapAccess ? (
              <MapSurface
                center={{ latitude: r.location.latitude, longitude: r.location.longitude }}
                zoom={14}
                interactive={false}
                markers={[
                  { id: 'now', coordinate: { latitude: r.location.latitude, longitude: r.location.longitude }, label: r.location.label },
                ]}
                style={styles.map}
              />
            ) : null}
            <View style={styles.mapFoot}>
              <View style={styles.flex}>
                <Text style={styles.rowValue}>{r.location.label}</Text>
                <Text style={styles.meta}>Updated {ago(r.location.updatedAt, now)}, refreshes by itself</Text>
              </View>
              <Button
                title="Open in Maps"
                variant="secondary"
                onPress={() =>
                  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${r.location!.latitude},${r.location!.longitude}`)
                }
              />
            </View>
          </View>
        </>
      ) : null}

      <SectionHead title="What happened" />
      {r.timeline.length === 0 ? (
        <Text style={styles.meta}>No history recorded yet.</Text>
      ) : (
        <View accessibilityRole="list">
          {r.timeline.map((line, i) => (
            <View key={`${line.at}-${i}`} style={styles.step} accessible accessibilityLabel={`${when(line.at)}, ${line.text}`}>
              <View style={styles.rail}>
                <View style={[styles.dot, line.tone === 'problem' ? styles.dotProblem : line.tone === 'done' ? styles.dotDone : null]} />
                {i < r.timeline.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.stepText}>
                <Text style={styles.rowValue}>{line.text}</Text>
                <Text style={styles.meta}>
                  {when(line.at)}
                  {line.ref !== r.ref ? `, ${line.ref}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {r.people.length ? (
        <>
          <SectionHead title="People" />
          {r.people.map((p) => (
            <View key={`${p.role}-${p.name}`} style={styles.person}>
              <View style={styles.flex}>
                <Text style={styles.rowValue}>{p.name}</Text>
                <Text style={styles.meta}>{p.role}</Text>
              </View>
              {p.phone ? (
                <PressableScale
                  onPress={() => void Linking.openURL(`tel:${p.phone}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${p.name}`}
                  style={styles.iconButton}
                >
                  <Phone size={18} color={palette.textSecondary} strokeWidth={1.8} />
                </PressableScale>
              ) : null}
              {p.email ? (
                <PressableScale
                  onPress={() => void Linking.openURL(`mailto:${p.email}?subject=${encodeURIComponent(`${r.label} ${r.ref}`)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Email ${p.name}`}
                  style={styles.iconButton}
                >
                  <Mail size={18} color={palette.textSecondary} strokeWidth={1.8} />
                </PressableScale>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {r.sections.map((section) => (
        <View key={section.title}>
          <SectionHead title={section.title} />
          {section.rows.map((row, i) => (
            <View key={`${row.label}-${i}`} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue} selectable>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {r.linked.length ? (
        <>
          <SectionHead title="Linked" />
          <View style={styles.chips}>
            {r.linked.map((l) => (
              <Chip
                key={l.ref}
                label={`${l.label} ${l.ref}`}
                accessibilityLabel={`Open ${l.label} ${l.ref}`}
                onPress={() => onOpen(l.ref)}
              />
            ))}
          </View>
        </>
      ) : null}

      {!r.location &&
      (r.type === 'J' || r.type === 'T') &&
      ['PROVIDER_EN_ROUTE', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(r.status) ? (
        <View style={styles.noLocation}>
          <MapPin size={16} color={palette.textMuted} strokeWidth={1.8} />
          <Text style={styles.meta}>No live location yet. It appears once their app shares it.</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  headMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  meta: { ...typography.caption, color: palette.textMuted },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  amount: { ...typography.title, color: palette.textPrimary, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
  mapCard: { borderRadius: radii.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  map: { height: 200 },
  mapFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: palette.surface },
  flex: { flex: 1 },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: palette.borderStrong },
  dotDone: { backgroundColor: palette.accent },
  dotProblem: { backgroundColor: palette.danger },
  line: { flex: 1, width: 2, backgroundColor: palette.border, marginTop: 2 },
  stepText: { flex: 1, paddingBottom: spacing.md },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowLabel: { ...typography.caption, color: palette.textMuted, width: 120 },
  rowValue: { ...typography.body, color: palette.textPrimary, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  noLocation: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
