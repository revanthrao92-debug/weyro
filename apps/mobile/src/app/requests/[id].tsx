import {
  View,
  Text,
  FlatList,
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { haptics } from '@/lib/haptics';
import { useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { useRouter, useLocalSearchParams, useIsFocused } from 'expo-router';
import { quoteMarkersFor, quoteTimeText, sortQuotes, timeLeft, type QuoteSort } from '@/utils/quotes';
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
  Chip,
  StatusPill,
  Skeleton,
  ErrorState,
  EmptyState,
  BackButton,
  FadeSlideIn,
  FlashBorder,
  CountUp,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';
import { titleize as labelize, requestStatusTone as statusTone } from '@/utils/format';
import { isNotFound } from '@/services/api-client';

type RequestParams = { id: string };

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<RequestParams>();
  const { role, providerProfile, customerProfile } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const focused = useIsFocused();
  const { data: request, isLoading, isError, error, refetch } = useRequest(id || '', focused);
  // The owner sees new quotes arrive while the request is open and in front.
  const isOwnerOfRequest = !!customerProfile && request?.customerId === customerProfile.id;
  const openToQuotes = ['OPEN', 'QUOTES_RECEIVED'].includes(request?.status ?? '');
  const { data: quotesData, isLoading: quotesLoading } = useRequestQuotations(
    id || '',
    focused && isOwnerOfRequest && openToQuotes,
  );
  // Quotes present on first load are the baseline; later arrivals get a one-time
  // highlight (ID-based, so phone/server clock skew can't misfire it).
  const [baselineQuoteIds, setBaselineQuoteIds] = useState<Set<string> | null>(null);
  if (baselineQuoteIds === null && quotesData) {
    setBaselineQuoteIds(new Set(quotesData.items.map((q) => q.id)));
  }
  const cancelRequest = useCancelRequest();
  const acceptQuotation = useAcceptQuotation();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  // /quotations/my is provider-only; customers would get a 403.
  const { data: myQuotesData } = useMyQuotations(
    { limit: 50 },
    role === 'PROVIDER' || role === 'BOTH',
  );
  const [editingQuote, setEditingQuote] = useState(false);

  // Checkpoint 3: providers get the quote form; customers keep Accept.
  const isProvider = role === 'PROVIDER' || role === 'BOTH';
  const now = useNow();
  // After the 24-hour window the server refuses new quotes, so the form hides too.
  const quotesClosed = !!request?.quotesUntil && timeLeft(request.quotesUntil, now) === null;
  const canQuote =
    isProvider && ['OPEN', 'QUOTES_RECEIVED'].includes(request?.status ?? '') && !quotesClosed;
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

  const [sortBy, setSortBy] = useState<QuoteSort>('cheapest');
  const quotes = sortQuotes(quotesData?.items ?? [], sortBy);
  const quoteMarkers = quoteMarkersFor(quotes);
  const quotesLeft = timeLeft(request?.quotesUntil, now);
  const quoteCardW = Math.min(windowWidth - 64, 400);
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

  // Only the customer who posted it may cancel or accept (the API enforces the same).
  const isOwner = isOwnerOfRequest;
  const canCancel = isOwner && openToQuotes;

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
      const booking = (await acceptQuotation.mutateAsync({
        quotationId: quotation.id,
        data: {},
      })) as { id?: string };
      haptics.success();
      router.replace(booking?.id ? `/booking/${booking.id}?confirmed=1` : '/bookings');
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
          <Text style={styles.sectionTitle}>{isOwner ? 'Quotes' : 'Your quote'}</Text>
          <Text style={styles.sectionCount}>{quotes.length}</Text>
        </View>

        {isOwner && openToQuotes && request.quotesUntil ? (
          <Text style={styles.windowNote}>
            {quotesLeft
              ? `Garages near you have been told. Taking quotes for ${quotesLeft}.`
              : quotes.length > 0
                ? `No new quotes now. Pick one of the ${quotes.length} you have.`
                : 'No quotes came in. Cancel this request and post it again to try once more.'}
          </Text>
        ) : null}

        {quotesLoading ? (
          <Card>
            <Skeleton width="100%" height={72} radius={radii.md} />
          </Card>
        ) : quotes.length === 0 ? (
          <Card>
            <EmptyState
              title="No quotes yet"
              message={
                isOwner
                  ? 'Providers nearby will respond here.'
                  : 'Send your price below.'
              }
            />
          </Card>
        ) : (
          <>
            {quotes.length > 1 ? (
              <>
                <View style={styles.sortRow}>
                  {SORTS.map((o) => (
                    <Chip
                      key={o.key}
                      label={o.label}
                      accessibilityLabel={`Sort quotes by ${o.label.toLowerCase()}`}
                      selected={sortBy === o.key}
                      onPress={() => setSortBy(o.key)}
                    />
                  ))}
                </View>
                <Text style={styles.swipeHint}>Swipe to compare {quotes.length} quotes</Text>
              </>
            ) : null}
            <FlatList
              data={quotes}
              keyExtractor={(item) => item.id}
              horizontal={quotes.length > 1}
              scrollEnabled={quotes.length > 1}
              showsHorizontalScrollIndicator={false}
              snapToInterval={quotes.length > 1 ? quoteCardW + spacing.md : undefined}
              decelerationRate="fast"
              contentContainerStyle={quotes.length > 1 ? { gap: spacing.md, paddingRight: spacing.lg } : undefined}
              renderItem={({ item, index }) => {
                const fresh = baselineQuoteIds !== null && !baselineQuoteIds.has(item.id);
                return (
                  <FadeSlideIn delay={index * 60} style={quotes.length > 1 ? { width: quoteCardW } : undefined}>
                    <FlashBorder active={fresh} radius={radii.md}>
                      <QuoteCard
                        quote={item}
                        onAccept={handleAccept}
                        canAccept={isOwner}
                        marker={quoteMarkers[item.id]}
                        fresh={fresh}
                      />
                    </FlashBorder>
                  </FadeSlideIn>
                );
              }}
            />
          </>
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
              <DetailRow label="Time" value={quoteTimeText(myQuote) ?? '—'} last />
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

const SORTS: { key: QuoteSort; label: string }[] = [
  { key: 'cheapest', label: 'Cheapest' },
  { key: 'soonest', label: 'Soonest' },
  { key: 'rated', label: 'Best rated' },
];

function QuoteCard({
  quote,
  onAccept,
  canAccept,
  marker,
  fresh = false,
}: {
  quote: any;
  onAccept: (q: any) => void;
  canAccept?: boolean;
  marker?: string;
  fresh?: boolean;
}) {
  const provider = quote.provider;
  const name = provider?.businessName || 'Garage';
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
          <Text style={styles.dealerName} numberOfLines={2}>{name}</Text>
          <View style={styles.dealerMetaRow}>
            {provider?.verificationStatus === 'VERIFIED' ? <StatusPill label="Verified" tone="success" /> : null}
            {rating ? <Text style={styles.dealerRating}>★ {rating}</Text> : null}
            <Text style={styles.dealerMeta}>{jobs} jobs done</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <CountUp
            value={Number(quote.totalCost)}
            animate={fresh}
            format={(n) => `₹${n.toLocaleString('en-IN')}`}
            style={styles.dealerAmount}
          />
        </View>
      </View>
      {/* Own line: "Best rated and ready soonest" is too long to share a row with the name. */}
      {marker ? (
        <View style={styles.markerRow}>
          <StatusPill label={marker} tone="info" />
        </View>
      ) : null}

      <View style={styles.dealerTags}>
        {quote.partCondition ? (
          <StatusPill label={quote.partCondition} tone="neutral" />
        ) : null}
        <StatusPill label={`${quote.warrantyDays}d warranty`} tone="success" />
        <StatusPill label={labelize(quote.status)} tone={statusTone(quote.status)} />
      </View>

      {quoteTimeText(quote) ? <Text style={styles.dealerEta}>{quoteTimeText(quote)}</Text> : null}
      {quote.notes ? <Text style={styles.dealerNotes}>{quote.notes}</Text> : null}

      {canAcceptNow ? (
        <Button title="Accept quote" onPress={() => onAccept(quote)} style={styles.acceptBtn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  windowNote: { ...typography.caption, color: palette.textSecondary, marginBottom: spacing.sm },
  markerRow: { flexDirection: 'row', marginTop: spacing.sm },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
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
  sectionTitle: { ...typography.bodyMedium, color: palette.textPrimary },
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
  dealerName: { ...typography.bodyMedium, color: palette.textPrimary, flexShrink: 1 },
  dealerMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  dealerRating: { ...typography.label, color: palette.textPrimary, fontWeight: '700' },
  dealerMeta: { ...typography.label, color: palette.textSecondary },
  dealerAmount: { ...typography.heading, color: palette.textPrimary },
  swipeHint: { ...typography.caption, color: palette.textMuted, marginBottom: spacing.sm },
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
