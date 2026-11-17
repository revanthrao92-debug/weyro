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
import {
  useRequest,
  useRequestQuotations,
  useCancelRequest,
  useAcceptQuotation,
  useCreateQuotation,
  useMyQuotations,
  useUpdateQuotation,
} from '@/hooks/useRequests';
import { QuoteComposer } from '@/components/dealer/QuoteComposer';
import {
  ScreenContainer,
  Card,
  Button,
  StatusPill,
  Skeleton,
  ErrorState,
  EmptyState,
  BackButton,
  FadeSlideIn,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';
import { titleize as labelize, requestStatusTone as statusTone } from '@/utils/format';
import { isNotFound } from '@/services/api-client';

type RequestParams = { id: string };

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<RequestParams>();
  const { role, providerProfile } = useAuth();
  const { data: request, isLoading, isError, error, refetch } = useRequest(id || '');
  const { data: quotesData, isLoading: quotesLoading } = useRequestQuotations(id || '');
  const cancelRequest = useCancelRequest();
  const acceptQuotation = useAcceptQuotation();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const { data: myQuotesData } = useMyQuotations({ limit: 50 });
  const [editingQuote, setEditingQuote] = useState(false);

  // Checkpoint 3: providers get the quote form; customers keep Accept.
  const isProvider = role === 'PROVIDER' || role === 'BOTH';
  const canQuote =
    isProvider && ['OPEN', 'QUOTES_RECEIVED'].includes(request?.status ?? '');
  const providerType = providerProfile?.providerType ?? '';
  const quoteMode =
    request?.category === 'TOWING'
      ? 'towing'
      : request?.category === 'ROADSIDE'
        ? 'roadside'
        : ['MECHANIC', 'GARAGE', 'AUTHORIZED_CENTER'].includes(providerType)
          ? 'service'
          : 'parts';
  const fareEstimate = Number(request?.towingEstimatedFare ?? 0);

  const quotes = quotesData?.items ?? [];
  const myQuote = (myQuotesData?.items ?? []).find(
    (quote) => quote.requestId === id,
  );

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark" safeBottom>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>Request</Text>
        </View>
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
        <BackButton />
        {isError && !isNotFound(error) ? (
          <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
        ) : (
          <ErrorState title="Request not found" message="This request may have been removed." />
        )}
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

  const photos = request.damagePhotos?.length ? request.damagePhotos : request.mediaUrls;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>Request</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Text style={styles.title}>{request.title}</Text>
        <View style={styles.metaRow}>
          <StatusPill label={labelize(request.status)} tone={statusTone(request.status)} />
          <StatusPill label={labelize(request.category)} tone="neutral" />
          <StatusPill label={labelize(request.urgency)} tone={request.urgency === 'EMERGENCY' ? 'danger' : request.urgency === 'URGENT' ? 'warning' : 'neutral'} />
        </View>
        <Text style={styles.address}>{request.address}</Text>

        {photos?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
          >
            {photos.map((url, index) => (
              <Image
                key={`${url}-${index}`}
                source={{ uri: url }}
                style={styles.photo}
                contentFit="cover"
                accessibilityLabel={`Damage photo ${index + 1}`}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Dealer responses</Text>
          <Text style={styles.sectionCount}>{quotes.length}</Text>
        </View>

        {quotesLoading ? (
          <Card>
            <Skeleton width="100%" height={72} radius={radii.md} />
          </Card>
        ) : quotes.length === 0 ? (
          <Card>
            <EmptyState title="No quotes yet" message="Dealers nearby will respond here." />
          </Card>
        ) : (
          <FlatList
            data={quotes}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <FadeSlideIn delay={index * 60}>
                <QuoteCard quote={item} onAccept={handleAccept} canAccept={!isProvider} />
              </FadeSlideIn>
            )}
          />
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Details</Text>
        </View>
        <Card>
          <DetailRow
            label="Vehicle"
            value={
              // Saved vehicle, or the free-form details typed on the request.
              [
                request.vehicle?.make ?? request.vehicleMake,
                request.vehicle?.model ?? request.vehicleModel,
                request.vehicle?.year ?? request.vehicleYear,
              ]
                .filter(Boolean)
                .join(' ') || '—'
            }
          />
          <DetailRow label="Description" value={request.description} />
          <DetailRow label="Address" value={request.address} last />
        </Card>

        {canQuote && myQuote && !editingQuote ? (
          <View style={styles.quoteForm}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Your quote</Text>
              <StatusPill label={labelize(myQuote.status)} tone={statusTone(myQuote.status)} />
            </View>
            <Card>
              <DetailRow label="Parts" value={`₹${Number(myQuote.partsCost).toLocaleString('en-IN')}`} />
              <DetailRow label="Labour" value={`₹${Number(myQuote.labourCost).toLocaleString('en-IN')}`} />
              <DetailRow label="Shipping" value={`₹${Number(myQuote.shippingCost ?? 0).toLocaleString('en-IN')}`} />
              <DetailRow label="Warranty" value={`${myQuote.warrantyDays} days`} />
              <DetailRow label="ETA" value={myQuote.etaDescription} last />
            </Card>
            {myQuote.status === 'PENDING' ? (
              <Button
                title="Edit quote"
                variant="secondary"
                onPress={() => setEditingQuote(true)}
                style={styles.editQuoteBtn}
              />
            ) : null}
          </View>
        ) : null}

        {canQuote && (!myQuote || editingQuote) && (
          <View style={styles.quoteForm}>
            {editingQuote ? (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Update quotation</Text>
                <Button title="Cancel" variant="secondary" onPress={() => setEditingQuote(false)} />
              </View>
            ) : null}
            <QuoteComposer
              mode={quoteMode}
              estimate={quoteMode === 'towing' ? fareEstimate : undefined}
              initial={editingQuote ? myQuote : undefined}
              submitLabel={editingQuote ? 'Save quote' : 'Send quote'}
              submitting={createQuotation.isPending || updateQuotation.isPending}
              onSubmit={async (data) => {
                try {
                  if (editingQuote && myQuote) {
                    await updateQuotation.mutateAsync({ id: myQuote.id, data });
                    setEditingQuote(false);
                    Alert.alert('Saved', 'Your quotation has been updated.');
                  } else {
                    await createQuotation.mutateAsync({ requestId: request.id, data });
                    Alert.alert('Sent', 'Quotation submitted to the customer.');
                  }
                } catch (e: any) {
                  Alert.alert('Failed', e.message || 'Unable to submit quotation');
                }
              }}
            />
          </View>
        )}

        {canCancel && (
          <Button
            title="Cancel request"
            variant="destructive"
            onPress={handleCancel}
            style={styles.cancelBtn}
          />
        )}
      </ScrollView>
    </ScreenContainer>
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
  const provider = quote.provider;
  const name = provider?.businessName || 'Verified garage';
  const initial = name.charAt(0).toUpperCase();
  const rating = provider?.avgRating ? provider.avgRating.toFixed(1) : null;
  const jobs = provider?.completedJobs ?? 0;
  const canAcceptNow = canAccept !== false && quote.status === 'PENDING';

  return (
    <View style={styles.dealerCard}>
      <View style={styles.dealerTop}>
        <View style={styles.dealerAvatar}>
          <Text style={styles.dealerAvatarText}>{initial}</Text>
        </View>
        <View style={styles.dealerIdentity}>
          <Text style={styles.dealerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.dealerMeta}>
            {rating ? `★ ${rating}  ·  ` : ''}{jobs} jobs completed
          </Text>
        </View>
        <Text style={styles.dealerAmount}>₹{quote.totalCost.toLocaleString()}</Text>
      </View>

      <View style={styles.dealerTags}>
        {quote.partCondition ? (
          <StatusPill label={quote.partCondition} tone="neutral" />
        ) : null}
        <StatusPill label={`${quote.warrantyDays}d warranty`} tone="success" />
        <StatusPill label={labelize(quote.status)} tone={statusTone(quote.status)} />
      </View>

      {quote.etaDescription ? (
        <Text style={styles.dealerEta}>{quote.etaDescription}</Text>
      ) : null}
      {quote.notes ? <Text style={styles.dealerNotes}>{quote.notes}</Text> : null}

      {canAcceptNow ? (
        <Button title="Accept quote" onPress={() => onAccept(quote)} style={styles.acceptBtn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  address: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.sm,
  },
  photoRow: { gap: spacing.sm, paddingTop: spacing.lg },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
  },
  skeletonCard: { marginBottom: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: palette.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionCount: { ...typography.label, color: palette.accent },
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
  dealerCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dealerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dealerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerAvatarText: {
    ...typography.bodyMedium,
    color: palette.accent,
  },
  dealerIdentity: { flex: 1 },
  dealerName: { ...typography.bodyMedium, color: palette.textPrimary },
  dealerMeta: { ...typography.label, color: palette.textSecondary, marginTop: 2 },
  dealerAmount: { ...typography.heading, color: palette.textPrimary },
  dealerTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dealerEta: {
    ...typography.caption,
    color: palette.textPrimary,
    marginTop: spacing.md,
  },
  dealerNotes: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  acceptBtn: { marginTop: spacing.lg },
  editQuoteBtn: { marginTop: spacing.md },
  quoteForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
  fieldLabel: {
    ...typography.captionMedium,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  conditionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  },
  totalValue: {
    ...typography.heading,
    color: palette.textPrimary,
  },
  cancelBtn: { marginTop: spacing.xxl },
});
