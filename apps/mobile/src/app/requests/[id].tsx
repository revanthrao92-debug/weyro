import {
  View,
  Text,
  FlatList,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useRequest, useRequestQuotations, useCancelRequest, useAcceptQuotation } from '@/hooks/useRequests';
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
} from '@/components/ui';
import { StatusTone, palette, spacing, radii, typography } from '@/theme';

type RequestParams = { id: string };

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace('_', ' ');
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN':
    case 'QUOTES_RECEIVED':
      return 'info';
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<RequestParams>();
  const { data: request, isLoading } = useRequest(id || '');
  const { data: quotesData, isLoading: quotesLoading } = useRequestQuotations(id || '');
  const cancelRequest = useCancelRequest();
  const acceptQuotation = useAcceptQuotation();

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
              renderItem={({ item }) => <QuoteCard quote={item} onAccept={handleAccept} />}
            />
          )}
        </Card>

        {canCancel && (
          <Button title="Cancel Request" variant="destructive" onPress={handleCancel} />
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

function QuoteCard({ quote, onAccept }: { quote: any; onAccept: (q: any) => void }) {
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
      <Button title="Accept" onPress={() => onAccept(quote)} style={styles.acceptBtn} />
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
});
