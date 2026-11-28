import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, StatusPill } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import type { CreateQuotation } from '@/hooks/useRequests';
import { durationLabel, readyBy, shortDay } from '@/utils/quotes';
import { formatRupees } from '@/utils/format';

type Props = {
  mode?: 'parts' | 'service' | 'towing' | 'roadside';
  /** Platform fare estimate shown for towing (server still computes the final value). */
  estimate?: number;
  initial?: Partial<Omit<CreateQuotation, 'startsAt' | 'durationHours'>> & {
    startsAt?: string | null;
    durationHours?: number | null;
  };
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (data: CreateQuotation) => Promise<void> | void;
};

const CONDITIONS = ['OEM', 'AFTERMARKET', 'USED'] as const;
const PART_DELIVERY = [
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'DOORSTEP_DELIVERY', label: 'Doorstep' },
  { value: 'PARTS_COURIER', label: 'Courier' },
] as const;

/** "Can start" choices, in days from today. */
const STARTS = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Tomorrow' },
  { days: 2, label: 'In 2 days' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'Next week' },
] as const;
/** "Takes about" choices, in hours. */
const DURATIONS = [2, 5, 24, 48, 72, 168] as const;
const durationText = (h: number) => (h === 5 ? 'Half a day' : durationLabel(h));

/** Today = now; a later day = 9 am that day on the phone's clock. */
function startFor(days: number) {
  const d = new Date();
  if (days > 0) {
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

/** Pre-select the closest choices when editing an existing quote. */
function nearestStart(startsAt?: string | null) {
  if (!startsAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(startsAt).getTime() - today.getTime()) / 86_400_000);
  return STARTS.reduce((a, b) => (Math.abs(b.days - diff) < Math.abs(a.days - diff) ? b : a)).days;
}
function nearestDuration(hours?: number | null) {
  if (!hours) return null;
  return DURATIONS.reduce((a, b) => (Math.abs(b - hours) < Math.abs(a - hours) ? b : a));
}

const SERVICE_MODE = [
  { value: 'PICKUP', label: 'Drop-off' },
  { value: 'ON_SITE_FITMENT', label: 'On-site' },
  { value: 'DOORSTEP_DELIVERY', label: 'Pickup & return' },
] as const;

export function QuoteComposer({
  mode = 'parts',
  estimate,
  initial,
  submitting,
  submitLabel = 'Send quote',
  onSubmit,
}: Props) {
  const [partsCost, setPartsCost] = useState(
    initial?.partsCost ? String(initial.partsCost) : '',
  );
  const [labourCost, setLabourCost] = useState(
    initial?.labourCost ? String(initial.labourCost) : '',
  );
  const [shippingCost, setShippingCost] = useState(
    initial?.shippingCost ? String(initial.shippingCost) : '',
  );
  const [warrantyDays, setWarrantyDays] = useState(
    String(initial?.warrantyDays ?? 30),
  );
  const [etaDescription, setEtaDescription] = useState(
    initial?.etaDescription ?? '',
  );
  const [startDays, setStartDays] = useState<number | null>(nearestStart(initial?.startsAt));
  const [durationHours, setDurationHours] = useState<number | null>(nearestDuration(initial?.durationHours));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>(
    (initial?.partCondition as (typeof CONDITIONS)[number]) ?? 'OEM',
  );
  const [delivery, setDelivery] = useState(
    (initial?.deliveryMethod as string) ??
      (mode === 'parts'
        ? 'PARTS_COURIER'
        : mode === 'roadside'
          ? 'ON_SITE_FITMENT'
          : 'PICKUP'),
  );

  const isTowing = mode === 'towing';
  const isRoadside = mode === 'roadside';
  const parts = Number(partsCost) || 0;
  const labour = Number(labourCost) || 0;
  const shipping = Number(shippingCost) || 0;
  const total = isTowing
    ? Number(estimate ?? 0)
    : parts + labour + shipping;
  // Towing and roadside answer in minutes ("25 minutes to pickup"), so they keep a typed time.
  const typedTime = isTowing || isRoadside;
  const startsAt = startDays !== null ? startFor(startDays) : null;
  const ready = startsAt && durationHours ? readyBy({ startsAt: startsAt.toISOString(), durationHours }) : null;
  const valid =
    (typedTime ? etaDescription.trim().length >= 2 : !!ready) && (isTowing || total > 0);

  return (
    <View style={styles.form}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {mode === 'parts'
            ? 'Price this request'
            : mode === 'towing'
              ? 'Send towing fare'
              : isRoadside
                ? 'Price this call'
                : 'Price this job'}
        </Text>
        {mode === 'parts' ? <StatusPill label={condition === 'OEM' ? 'OEM' : condition.charAt(0) + condition.slice(1).toLowerCase()} tone="info" /> : null}
      </View>

      {!isTowing ? (
        <>
          <Input
            label={mode === 'parts' ? 'Parts cost (₹)' : 'Parts (₹, optional)'}
            placeholder="5000"
            value={partsCost}
            onChangeText={setPartsCost}
            keyboardType="number-pad"
          />
          <Input
            label={isRoadside ? 'Labour (₹)' : 'Labour (₹)'}
            placeholder="0"
            value={labourCost}
            onChangeText={setLabourCost}
            keyboardType="number-pad"
          />
          <Input
            label={
              mode === 'parts'
                ? 'Shipping (₹)'
                : isRoadside
                  ? 'Callout (₹)'
                  : 'Callout / travel (₹, optional)'
            }
            placeholder="0"
            value={shippingCost}
            onChangeText={setShippingCost}
            keyboardType="number-pad"
          />
        </>
      ) : null}

      {mode === 'parts' ? (
        <>
          <Text style={styles.fieldLabel}>Part condition</Text>
          <View style={styles.chipRow}>
            {CONDITIONS.map((c) => (
              <Chip
                key={c}
                label={c === 'OEM' ? 'OEM' : c.charAt(0) + c.slice(1).toLowerCase()}
                selected={condition === c}
                onPress={() => setCondition(c)}
              />
            ))}
          </View>
        </>
      ) : null}

      {mode === 'parts' || mode === 'service' ? (
        <>
          <Text style={styles.fieldLabel}>
            {mode === 'parts' ? 'Delivery' : 'Service mode'}
          </Text>
          <View style={styles.chipRow}>
            {(mode === 'parts' ? PART_DELIVERY : SERVICE_MODE).map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={delivery === d.value}
                onPress={() => setDelivery(d.value)}
              />
            ))}
          </View>
        </>
      ) : null}

      {!isTowing ? (
        <Input
          label="Warranty (days)"
          placeholder="30"
          value={warrantyDays}
          onChangeText={setWarrantyDays}
          keyboardType="number-pad"
        />
      ) : null}
      {typedTime ? (
        <Input
          label={isTowing ? 'Pickup ETA' : 'Arrival time'}
          placeholder="e.g. 25 minutes to pickup"
          value={etaDescription}
          onChangeText={setEtaDescription}
        />
      ) : (
        <>
          <Text style={styles.fieldLabel}>{mode === 'parts' ? 'Can send' : 'Can start'}</Text>
          <View style={styles.chipRow}>
            {STARTS.map((o) => (
              <Chip key={o.days} label={o.label} selected={startDays === o.days} onPress={() => setStartDays(o.days)} />
            ))}
          </View>
          <Text style={styles.fieldLabel}>{mode === 'parts' ? 'Delivery takes about' : 'Takes about'}</Text>
          <View style={styles.chipRow}>
            {DURATIONS.map((h) => (
              <Chip key={h} label={durationText(h)} selected={durationHours === h} onPress={() => setDurationHours(h)} />
            ))}
          </View>
          <Text style={styles.ready}>
            {ready ? `${mode === 'parts' ? 'Arrives by' : 'Ready by'} ${shortDay(ready)}` : 'Pick when you can start and how long it takes.'}
          </Text>
        </>
      )}
      <Input
        label="Notes (optional)"
        placeholder="Anything the customer should know"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {isTowing ? 'Fare (platform estimate)' : 'Quote total'}
        </Text>
        <Text style={styles.totalValue}>{formatRupees(total)}</Text>
      </View>
      {isTowing ? (
        <Text style={styles.hint}>
          Final fare is calculated by Weyro from the towing distance and your
          tariff. Confirm the estimate to send it to the customer.
        </Text>
      ) : null}

      <Button
        title={submitLabel}
        loading={submitting}
        disabled={!valid || submitting}
        onPress={() =>
          void onSubmit({
            partsCost: isTowing ? 0 : parts,
            labourCost: isTowing ? 0 : labour,
            ...(isTowing ? {} : { shippingCost: shipping }),
            ...(mode === 'parts' ? { partCondition: condition } : {}),
            warrantyDays: isTowing
              ? 0
              : Math.max(0, Number(warrantyDays) || 0),
            ...(typedTime
              ? { etaDescription: etaDescription.trim() }
              : { startsAt: startsAt?.toISOString(), durationHours: durationHours ?? undefined }),
            ...(isTowing || isRoadside ? { deliveryMethod: isRoadside ? 'ON_SITE_FITMENT' : undefined } : { deliveryMethod: delivery }),
            notes: notes.trim() || undefined,
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...typography.bodyMedium, color: palette.textPrimary },
  fieldLabel: { ...typography.label, color: palette.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  totalLabel: { ...typography.label, color: palette.textMuted },
  totalValue: { ...typography.title, color: palette.textPrimary },
  hint: { ...typography.caption, color: palette.textMuted, lineHeight: 18 },
  ready: { ...typography.bodyMedium, color: palette.textPrimary },
});
