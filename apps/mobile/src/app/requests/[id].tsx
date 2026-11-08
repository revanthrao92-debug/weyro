import {
  View,
  Text,
  FlatList,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/hooks/useAuth';
import { useRequest, useRequestQuotations, useCancelRequest, useAcceptQuotation, useCreateQuotation } from '@/hooks/useRequests';
import {
  ScreenContainer,
  AppHeader,
  Card,
  Button,
  StatusPill,
  Skeleton,
  ErrorState,
  EmptyState,
  BackButton,
  Input,
  Chip,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';
import { titleize as labelize, requestStatusTone as statusTone } from '@/utils/format';

type RequestParams = { id: string };





export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<RequestParams>();
  const { role } = useAuth();
  const { data: request, isLoading } = useRequest(id || '');
  const { data: quotesData, isLoading: quotesLoading } = useRequestQuotations(id || '');
  const cancelRequest = useCancelRequest();
  const acceptQuotation = useAcceptQuotation();
  const createQuotation = useCreateQuotation();

  // Checkpoint 3: providers get the quote form; customers keep Accept.
  const isProvider = role === 'PROVIDER' || role === 'BOTH';
  const canQuote =
    isProvider && ['OPEN', 'QUOTES_RECEIVED'].includes(request?.status ?? '');

  const quotes = quotesData?.items ?? [];

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Request" />
        <Card style={styles.skeletonCard}>
          <Skeleton width="50%" height={18} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={12} style={{ marginTop: spacing.sm }} />
          ))}
        </Card>
      </ScreenContainer>
    );
  }

  if (!request) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <AppHeader left={<BackButton />} title="Request" />
        <ErrorState title="Request not found" message="This request may have been removed." />
      </ScreenContainer>
    );
  }

  const canCancel = request.status === 'OPEN' || request.status === 'QUOTES_RECEIVED';

  const handleCancel = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Cancel Request',
        'Are you sure you want to cancel this request?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cancel Request', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;
    try {
      await cancelRequest.mutateAsync(request.id);
      Alert.alert('Success', 'Request cancelled');
      router.replace('/requests/my');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to cancel request');
    }
  };

  const handleAccept = async (quotation: any) => {
    try {
      await acceptQuotation.mutateAsync({
        quotationId: quotation.id,
        data: {},
      });
      Alert.alert('Success', 'Quotation accepted. Booking created!');
      router.replace(`/bookings`);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to accept quotation');
    }
  };

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader left={<BackButton />} title={`Request #${request.id.slice(0, 8)}`} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={styles.sectionTitle}>Request Details</Text>
          <DetailRow label="Category" value={labelize(request.category)} />
          <DetailRow label="Title" value={request.title} />
          <DetailRow label="Description" value={request.description} />
          <DetailRow label="Address" value={request.address} />
          <DetailRow label="Urgency" value={request.urgency} last />
        </Card>

        {(request.damagePhotos?.length || request.mediaUrls?.length) ? (
          <Card>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {(request.damagePhotos?.length ? request.damagePhotos : request.mediaUrls).map(
                (url, index) => (
                  <Image
                    key={`${url}-${index}`}
                    source={{ uri: url }}
                    style={styles.photo}
                    contentFit="cover"
                    accessibilityLabel={`Damage photo ${index + 1}`}
                  />
                )
              )}
            </ScrollView>
          </Card>
        ) : null}

        <Card>
          <View style={styles.quotesHeader}>
            <Text style={styles.sectionTitle}>Quotes</Text>
            <StatusPill label={`${quotes.length}`} tone="neutral" />
          </View>
          {quotesLoading ? (
            <Skeleton width="100%" height={48} radius={radii.md} />
          ) : quotes.length === 0 ? (
            <EmptyState title="No quotes yet" message="Providers will send quotes here." />
          ) : (
            <FlatList
              data={quotes}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <QuoteCard quote={item} onAccept={handleAccept} canAccept={!isProvider} />
              )}
            />
          )}
        </Card>

        {canQuote && (
          <QuoteForm
            onSubmit={async (data) => {
              try {
                await createQuotation.mutateAsync({ requestId: request.id, data });
                Alert.alert('Success', 'Quotation submitted to the customer.');
              } catch (e: any) {
                Alert.alert('Failed', e.message || 'Unable to submit quotation');
              }
            }}
            submitting={createQuotation.isPending}
          />
        )}

        {canCancel && (
          <Button title="Cancel Request" variant="destructive" onPress={handleCancel} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * Provider-facing quote form (Checkpoint 3). Photo-7 style cost breakdown:
 * rigid labeled rows, single primary CTA, status chip feedback.
 */
function QuoteForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (data: {
    partsCost: number;
    labourCost: number;
    shippingCost?: number;
    partCondition?: 'OEM' | 'AFTERMARKET' | 'USED';
    warrantyDays: number;
    etaDescription: string;
    deliveryMethod?: 'PICKUP' | 'DOORSTEP_DELIVERY' | 'PARTS_COURIER' | 'ON_SITE_FITMENT';
    notes?: string;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [partsCost, setPartsCost] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('30');
  const [etaDescription, setEtaDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState<'OEM' | 'AFTERMARKET' | 'USED'>('OEM');

  const parts = Number(partsCost) || 0;
  const labour = Number(labourCost) || 0;
  const total = parts + labour;

  const valid = parts > 0;

  return (
    <Card>
      <View style={styles.quotesHeader}>
        <Text style={styles.sectionTitle}>Submit quotation</Text>
        <StatusPill label={condition} tone="info" />
      </View>

      <Input
        label="Parts cost (₹)"
        placeholder="5000"
        value={partsCost}
        onChangeText={setPartsCost}
        keyboardType="number-pad"
      />
      <Input
        label="Labour cost (₹)"
        placeholder="1500"
        value={labourCost}
        onChangeText={setLabourCost}
        keyboardType="number-pad"
      />
      <Input
        label="Warranty (days)"
        placeholder="30"
        value={warrantyDays}
        onChangeText={setWarrantyDays}
        keyboardType="number-pad"
      />

      <View style={styles.conditionRow}>
        {(['OEM', 'AFTERMARKET', 'USED'] as const).map((c) => (
          <Chip
            key={c}
            label={c}
            selected={condition === c}
            onPress={() => setCondition(c)}
          />
        ))}
      </View>

      <Input
        label="Estimated time to complete"
        placeholder='e.g. "Same day if part in stock"'
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
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>₹{total.toLocaleString()}</Text>
      </View>

      <Button
        title="Submit quotation"
        loading={submitting}
        disabled={!valid || submitting || etaDescription.trim().length < 2}
        onPress={() =>
          void onSubmit({
            partsCost: parts,
            labourCost: labour,
            partCondition: condition,
            warrantyDays: Math.max(0, Number(warrantyDays) || 0),
            etaDescription: etaDescription.trim(),
            notes: notes.trim() || undefined,
          })
        }
      />
    </Card>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function QuoteCard({
  quote,
  onAccept,
  canAccept,
}: {
  quote: any;
  onAccept: (q: any) => void;
  canAccept?: boolean;
}) {
  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteInfo}>
        <Text style={styles.quoteProvider}>Provider</Text>
        <Text style={styles.quoteAmount}>₹{quote.totalCost.toLocaleString()}</Text>
        <StatusPill label={labelize(quote.status)} tone={statusTone(quote.status)} />
        {quote.warrantyDays !== undefined && (
          <Text style={styles.quoteWarranty}>{quote.warrantyDays} days warranty</Text>
        )}
      </View>
      {canAccept !== false ? (
        <Button title="Accept" onPress={() => onAccept(quote)} style={styles.acceptBtn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  photoRow: { gap: spacing.sm, paddingTop: spacing.sm },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  skeletonCard: { marginBottom: spacing.md },
  sectionTitle: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceAlt,
    gap: spacing.md,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { ...typography.caption, color: palette.textSecondary },
  detailValue: {
    ...typography.captionMedium,
    color: palette.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  quotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  quoteCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceAlt,
    gap: spacing.md,
  },
  quoteInfo: { flex: 1 },
  quoteProvider: { ...typography.caption, color: palette.textSecondary },
  quoteAmount: { ...typography.title, color: palette.textPrimary, marginBottom: spacing.xs },
  quoteWarranty: { ...typography.label, color: palette.success, marginTop: spacing.xs },
  acceptBtn: { minWidth: 96 },
  conditionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  totalValue: {
    ...typography.heading,
    color: palette.textPrimary,
  },
});
