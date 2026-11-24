import { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useSparePartOrder,
  useUpdateFulfillment,
  type FulfillmentStatus,
  type SparePartOrder,
} from '@/hooks/useParts';
import { useAuth } from '@/hooks/useAuth';
import {
  AppHeader,
  BackButton,
  Button,
  Card,
  EmptyState,
  Input,
  ScreenContainer,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import {
  palette,
  spacing,
  typography,
  type StatusTone,
} from '@/theme';
import { formatDate, titleize } from '@/utils/format';

const STEPS: FulfillmentStatus[] = [
  'PENDING',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
];

function tone(status: string): StatusTone {
  if (status === 'DELIVERED') return 'success';
  if (status === 'SHIPPED') return 'info';
  if (status === 'PROCESSING') return 'warning';
  return 'neutral';
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, isError } = useSparePartOrder(id ?? '');
  const isDealer = role === 'PROVIDER' || role === 'BOTH';
  const updateFulfillment = useUpdateFulfillment();
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [showShipForm, setShowShipForm] = useState(false);

  if (isLoading) {
    return (
      <ScreenContainer chrome="header" safeBottom>
        <AppHeader left={<BackButton />} title="Order" subtitle="Loading" />
        <View style={styles.body}>
          <Skeleton width="100%" height={110} />
          <Skeleton width="100%" height={180} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !order) {
    return (
      <ScreenContainer chrome="header" safeBottom>
        <AppHeader left={<BackButton />} title="Order" />
        <EmptyState
          title="Order unavailable"
          message="This order may have been removed or belongs to another dealer."
          action={<Button title="Go back" onPress={() => router.back()} />}
        />
      </ScreenContainer>
    );
  }

  if (!isDealer) {
    return <CustomerOrderView order={order} />;
  }

  const current = (order.fulfillmentStatus ?? 'PENDING') as FulfillmentStatus;
  const canFulfill = order.status === 'PAID' && current !== 'DELIVERED';

  const nextStep = (): FulfillmentStatus | null => {
    switch (current) {
      case 'PENDING':
        return 'PROCESSING';
      case 'PROCESSING':
        return 'READY';
      case 'READY':
        return 'SHIPPED';
      case 'SHIPPED':
        return 'DELIVERED';
      default:
        return null;
    }
  };

  const advance = async (status: FulfillmentStatus, extra?: Record<string, string>) => {
    try {
      await updateFulfillment.mutateAsync({
        orderId: order.id,
        status,
        ...extra,
      });
      setShowShipForm(false);
      setNotes('');
      if (status === 'SHIPPED') {
        setCarrierName('');
        setTrackingNumber('');
      }
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update fulfillment.');
    }
  };

  const next = nextStep();

  const onPrimary = () => {
    if (!next) return;
    if (next === 'SHIPPED') {
      setShowShipForm(true);
      return;
    }
    void advance(next, notes.trim() ? { dealerNotes: notes.trim() } : undefined);
  };

  return (
    <ScreenContainer chrome="header" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>Order</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {order.sparePart?.name ?? 'Spare part'}
        </Text>
        <View style={styles.metaRow}>
          <StatusPill
            label={titleize(order.status)}
            tone={order.status === 'PAID' ? 'success' : order.status === 'PENDING' ? 'warning' : 'danger'}
          />
          {order.status === 'PAID' ? (
            <StatusPill label={titleize(current)} tone={tone(current)} />
          ) : null}
          <Text style={styles.meta}>
            #{order.id.slice(0, 8).toUpperCase()} · qty {order.quantity}
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.amount}>
            ₹{Number(order.totalAmount).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.meta}>
            {order.paidAt ? `Paid ${formatDate(order.paidAt)}` : 'Payment not completed'}
          </Text>
        </Card>

        {order.status === 'PAID' ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Fulfillment</Text>
            <FulfillmentSteps current={current} />

            {order.carrierName || order.trackingNumber ? (
              <View style={styles.tracking}>
                <Text style={styles.meta}>
                  {order.carrierName ?? 'Carrier'} · {order.trackingNumber ?? 'No tracking yet'}
                </Text>
                {order.trackingNumber ? (
                  <Button
                    title="Track shipment"
                    variant="secondary"
                    onPress={() =>
                      void Linking.openURL(
                        `https://www.google.com/search?q=${encodeURIComponent(
                          `${order.carrierName ?? ''} ${order.trackingNumber}`,
                        )}`,
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}

            {order.dealerNotes ? (
              <Text style={styles.notes}>Note: {order.dealerNotes}</Text>
            ) : null}

            {canFulfill && next && !showShipForm ? (
              <>
                <Input
                  label="Note to customer (optional)"
                  placeholder="e.g. Packed and ready for pickup"
                  value={notes}
                  onChangeText={setNotes}
                />
                <Button
                  title={next === 'PROCESSING' ? 'Start processing' : next === 'READY' ? 'Mark ready' : next === 'DELIVERED' ? 'Mark delivered' : 'Mark shipped'}
                  loading={updateFulfillment.isPending}
                  onPress={onPrimary}
                />
                {current !== 'SHIPPED' ? (
                  <Button
                    title="Mark shipped"
                    variant="secondary"
                    onPress={() => setShowShipForm(true)}
                  />
                ) : null}
              </>
            ) : null}

            {showShipForm && canFulfill ? (
              <View style={styles.shipForm}>
                <Text style={styles.sectionTitle}>Shipping details</Text>
                <Input
                  label="Carrier"
                  placeholder="Delhivery, Blue Dart…"
                  value={carrierName}
                  onChangeText={setCarrierName}
                />
                <Input
                  label="Tracking number"
                  placeholder="Tracking ID"
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                />
                <Button
                  title="Mark shipped"
                  loading={updateFulfillment.isPending}
                  disabled={!carrierName.trim() || !trackingNumber.trim()}
                  onPress={() =>
                    void advance('SHIPPED', {
                      carrierName: carrierName.trim(),
                      trackingNumber: trackingNumber.trim(),
                      ...(notes.trim() ? { dealerNotes: notes.trim() } : {}),
                    })
                  }
                />
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setShowShipForm(false)}
                />
              </View>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Awaiting payment</Text>
            <Text style={styles.meta}>
              You can start fulfillment once the payment is confirmed.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Deliver to</Text>
          <Row label="Name" value={order.shippingName ?? order.customer?.firstName ?? '—'} />
          <Row label="Phone" value={order.shippingPhone ?? '—'} />
          <Row
            label="Address"
            value={[order.shippingAddress, order.shippingCity, order.shippingPincode]
              .filter(Boolean)
              .join(', ') || 'Not provided'}
          />
          {order.shippingPhone ? (
            <Button
              title="Call customer"
              variant="secondary"
              onPress={() => void Linking.openURL(`tel:${order.shippingPhone}`)}
            />
          ) : null}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function FulfillmentSteps({ current }: { current: FulfillmentStatus }) {
  const stepIndex = STEPS.indexOf(current);
  return (
    <View style={styles.steps}>
      {STEPS.map((step, index) => {
        const done = stepIndex >= index;
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.dot, done && styles.dotDone]} />
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
              {titleize(step)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CustomerOrderView({ order }: { order: SparePartOrder }) {
  const current = (order.fulfillmentStatus ?? 'PENDING') as FulfillmentStatus;
  const address = [
    order.shippingAddress,
    order.shippingCity,
    order.shippingPincode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ScreenContainer chrome="header" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>Order</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {order.sparePart?.name ?? 'Spare part'}
        </Text>
        <View style={styles.metaRow}>
          <StatusPill
            label={titleize(order.status)}
            tone={order.status === 'PAID' ? 'success' : order.status === 'PENDING' ? 'warning' : 'danger'}
          />
          {order.status === 'PAID' ? (
            <StatusPill label={titleize(current)} tone={tone(current)} />
          ) : null}
          <Text style={styles.meta}>
            #{order.id.slice(0, 8).toUpperCase()} · qty {order.quantity}
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.amount}>
            ₹{Number(order.totalAmount).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.meta}>
            {order.paidAt ? `Paid ${formatDate(order.paidAt)}` : 'Payment not completed'}
          </Text>
        </Card>

        {order.status === 'PAID' ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery status</Text>
            <FulfillmentSteps current={current} />
            {order.shippedAt ? (
              <Text style={styles.meta}>Shipped {formatDate(order.shippedAt)}</Text>
            ) : null}
            {order.deliveredAt ? (
              <Text style={styles.meta}>Delivered {formatDate(order.deliveredAt)}</Text>
            ) : null}

            {order.carrierName || order.trackingNumber ? (
              <View style={styles.tracking}>
                <Text style={styles.meta}>
                  {order.carrierName ?? 'Carrier'} · {order.trackingNumber ?? 'No tracking yet'}
                </Text>
                {order.trackingNumber ? (
                  <Button
                    title="Track shipment"
                    variant="secondary"
                    onPress={() =>
                      void Linking.openURL(
                        `https://www.google.com/search?q=${encodeURIComponent(
                          `${order.carrierName ?? ''} ${order.trackingNumber}`,
                        )}`,
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}

            {order.dealerNotes ? (
              <Text style={styles.notes}>Note from dealer: {order.dealerNotes}</Text>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Awaiting payment</Text>
            <Text style={styles.meta}>
              This order is recorded but not paid yet. The dealer can ship it once
              payment is confirmed.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Delivering to</Text>
          <Row label="Name" value={order.shippingName ?? '—'} />
          <Row label="Phone" value={order.shippingPhone ?? '—'} />
          <Row label="Address" value={address || 'Not provided'} />
        </Card>

        {order.provider?.businessName ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Sold by</Text>
            <Text style={styles.meta}>{order.provider.businessName}</Text>
            {order.provider.avgRating ? (
              <Text style={styles.meta}>
                ★ {Number(order.provider.avgRating).toFixed(1)} ·{' '}
                {order.provider.verificationStatus?.toLowerCase()}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Button
          title="Contact support"
          variant="secondary"
          onPress={() => void Linking.openURL('mailto:support@weyro.app')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topBarSpacer: { width: 44 },
  eyebrow: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.3,
  },
  title: { ...typography.display, color: palette.textPrimary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  meta: { ...typography.caption, color: palette.textMuted, lineHeight: 18 },
  card: { marginTop: spacing.lg, gap: spacing.md },
  amount: { ...typography.title, color: palette.textPrimary },
  sectionTitle: { ...typography.captionMedium, color: palette.textPrimary },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.borderStrong,
  },
  dotDone: { backgroundColor: palette.accent },
  stepLabel: { ...typography.label, color: palette.textMuted },
  stepLabelDone: { color: palette.textPrimary },
  tracking: { gap: spacing.sm },
  notes: { ...typography.caption, color: palette.textSecondary },
  shipForm: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: { ...typography.label, color: palette.textMuted },
  rowValue: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});
