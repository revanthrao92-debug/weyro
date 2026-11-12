import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, StatusPill } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';
import type { CreateQuotation } from '@/hooks/useRequests';

type Props = {
  mode?: 'parts' | 'service';
  initial?: Partial<CreateQuotation>;
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

const SERVICE_MODE = [
  { value: 'PICKUP', label: 'Drop-off' },
  { value: 'ON_SITE_FITMENT', label: 'On-site' },
  { value: 'DOORSTEP_DELIVERY', label: 'Pickup & return' },
] as const;

export function QuoteComposer({
  mode = 'parts',
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
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>(
    (initial?.partCondition as (typeof CONDITIONS)[number]) ?? 'OEM',
  );
  const [delivery, setDelivery] = useState(
    (initial?.deliveryMethod as string) ??
      (mode === 'parts' ? 'PARTS_COURIER' : 'PICKUP'),
  );

  const parts = Number(partsCost) || 0;
  const labour = Number(labourCost) || 0;
  const shipping = Number(shippingCost) || 0;
  const total = parts + labour + shipping;
  const valid = total > 0 && etaDescription.trim().length >= 2;

  return (
    <View style={styles.form}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {mode === 'parts' ? 'Price this request' : 'Price this job'}
        </Text>
        {mode === 'parts' ? <StatusPill label={condition} tone="info" /> : null}
      </View>

      <Input
        label={mode === 'parts' ? 'Parts cost (₹)' : 'Parts (₹, optional)'}
        placeholder="5000"
        value={partsCost}
        onChangeText={setPartsCost}
        keyboardType="number-pad"
      />
      <Input
        label="Labour (₹)"
        placeholder="0"
        value={labourCost}
        onChangeText={setLabourCost}
        keyboardType="number-pad"
      />
      <Input
        label={mode === 'parts' ? 'Shipping (₹)' : 'Callout / travel (₹, optional)'}
        placeholder="0"
        value={shippingCost}
        onChangeText={setShippingCost}
        keyboardType="number-pad"
      />

      {mode === 'parts' ? (
        <>
          <Text style={styles.fieldLabel}>Part condition</Text>
          <View style={styles.chipRow}>
            {CONDITIONS.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={condition === c}
                onPress={() => setCondition(c)}
              />
            ))}
          </View>
        </>
      ) : null}

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

      <Input
        label="Warranty (days)"
        placeholder="30"
        value={warrantyDays}
        onChangeText={setWarrantyDays}
        keyboardType="number-pad"
      />
      <Input
        label="Availability / ETA"
        placeholder='e.g. "Ready for pickup today"'
        value={etaDescription}
        onChangeText={setEtaDescription}
      />
      <Input
        label="Notes (optional)"
        placeholder="Anything the customer should know"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Quote total</Text>
        <Text style={styles.totalValue}>₹{total.toLocaleString('en-IN')}</Text>
      </View>

      <Button
        title={submitLabel}
        loading={submitting}
        disabled={!valid || submitting}
        onPress={() =>
          void onSubmit({
            partsCost: parts,
            labourCost: labour,
            shippingCost: shipping,
            ...(mode === 'parts' ? { partCondition: condition } : {}),
            warrantyDays: Math.max(0, Number(warrantyDays) || 0),
            etaDescription: etaDescription.trim(),
            deliveryMethod: delivery,
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
});
