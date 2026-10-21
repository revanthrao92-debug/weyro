import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BookingMilestoneStatus,
  BookingRecord,
  DamageRequestQuote,
  damageRequestStore,
  useBookings,
  useDamageRequests,
} from '@/services/damage-request-store';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { BookingCard } from '@/components/quotes/BookingCard';
import { AcceptQuoteModal } from '@/components/quotes/AcceptQuoteModal';
import { BookingReviewModal } from '@/components/quotes/BookingReviewModal';
import { EmptyListCard } from '@/components/quotes/EmptyListCard';

export default function QuotesAndBookingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();

  const requests = useDamageRequests();
  const bookings = useBookings();

  const [activeTab, setActiveTab] = useState<'QUOTES' | 'BOOKINGS'>('QUOTES');
  const [selectedQuote, setSelectedQuote] = useState<{
    requestId: string;
    quote: DamageRequestQuote;
  } | null>(null);
  const [reviewBooking, setReviewBooking] = useState<BookingRecord | null>(null);

  const handleAdvanceMilestone = (booking: BookingRecord) => {
    const transitions: Record<BookingMilestoneStatus, BookingMilestoneStatus> = {
      CONFIRMED: 'DISPATCHED_OR_IN_BAY',
      DISPATCHED_OR_IN_BAY: 'OUT_FOR_DELIVERY_OR_TESTING',
      OUT_FOR_DELIVERY_OR_TESTING: 'COMPLETED',
      COMPLETED: 'COMPLETED',
    };
    const nextStatus = transitions[booking.status];
    if (nextStatus && nextStatus !== booking.status) {
      damageRequestStore.updateBookingStatus(booking.id, nextStatus);
    }
  };

  const handleAcceptQuoteConfirm = async (address: string, date: string) => {
    if (!selectedQuote) return;

    try {
      await damageRequestStore.acceptQuote(
        selectedQuote.requestId,
        selectedQuote.quote.id,
        {
          deliveryAddress: address,
          scheduledDate: date,
        },
      );
      setSelectedQuote(null);
      setActiveTab('BOOKINGS');
      Alert.alert(
        'Booking Confirmed! 🎉',
        'Your appointment has been placed into the milestone ledger.',
      );
    } catch {
      Alert.alert(
        'Booking Not Confirmed',
        'We could not reach the server. Check your connection and try again.',
      );
    }
  };

  const handleReviewSubmit = (rating: number, comment: string) => {
    if (!reviewBooking) return;
    damageRequestStore.addBookingReview(reviewBooking.id, rating, comment);
    setReviewBooking(null);
    Alert.alert('Review Submitted ⭐', 'Thank you for rating your service.');
  };

  const allQuotes = requests.flatMap((r) =>
    r.quotes.map((q) => ({ requestId: r.id, requestTitle: r.damagedPart, quote: q })),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: safeAreaInsets.top + Spacing.three,
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Quotes & Service Ledger
            </ThemedText>
            <ThemedText style={styles.subtitle} themeColor="textSecondary">
              Review received quotations from verified garages or track active service milestones.
            </ThemedText>
          </View>

          {/* Tab Selector */}
          <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable
              onPress={() => setActiveTab('QUOTES')}
              style={[styles.tabBtn, activeTab === 'QUOTES' && { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.tabText, activeTab === 'QUOTES' && { color: theme.inverseText, fontWeight: '700' }]}>
                Quotations ({allQuotes.length})
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('BOOKINGS')}
              style={[styles.tabBtn, activeTab === 'BOOKINGS' && { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.tabText, activeTab === 'BOOKINGS' && { color: theme.inverseText, fontWeight: '700' }]}>
                Active Bookings ({bookings.length})
              </ThemedText>
            </Pressable>
          </View>

          {/* Quotations List */}
          {activeTab === 'QUOTES' && (
            <View style={styles.listSection}>
              {allQuotes.length === 0 ? (
                <EmptyListCard
                  title="No Quotes Yet"
                  subtitle="Broadcast a damage request to receive bids from verified mechanics and dealers."
                  actionText="+ Post New Request"
                  onAction={() => router.push('/')}
                />
              ) : (
                allQuotes.map(({ requestId, requestTitle, quote }) => (
                  <View key={quote.id}>
                    <ThemedText style={[styles.reqRefBadge, { color: theme.textSecondary }]}>
                      REQUEST: {requestTitle.toUpperCase()}
                    </ThemedText>
                    <QuoteCard
                      quote={quote}
                      onAccept={() => setSelectedQuote({ requestId, quote })}
                      onChat={() =>
                        router.push(`/chat?requestId=${requestId}&providerName=${encodeURIComponent(quote.providerName)}`)
                      }
                    />
                  </View>
                ))
              )}
            </View>
          )}

          {/* Bookings List */}
          {activeTab === 'BOOKINGS' && (
            <View style={styles.listSection}>
              {bookings.length === 0 ? (
                <EmptyListCard
                  title="No Active Bookings"
                  subtitle="When you accept a quote, your repair booking and milestone progress will appear here."
                />
              ) : (
                bookings.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onAdvanceMilestone={() => handleAdvanceMilestone(b)}
                    onOpenReview={() => setReviewBooking(b)}
                    onChat={() =>
                      router.push(`/chat?requestId=${b.requestId}&providerName=${encodeURIComponent(b.providerName)}`)
                    }
                  />
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <AcceptQuoteModal
        visible={Boolean(selectedQuote)}
        quote={selectedQuote?.quote || null}
        onClose={() => setSelectedQuote(null)}
        onConfirm={handleAcceptQuoteConfirm}
      />

      <BookingReviewModal
        visible={Boolean(reviewBooking)}
        booking={reviewBooking}
        onClose={() => setReviewBooking(null)}
        onSubmit={handleReviewSubmit}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.three, alignItems: 'center' },
  contentWrapper: { width: '100%', maxWidth: MaxContentWidth },
  header: { marginBottom: Spacing.three },
  title: { fontSize: 24, fontWeight: '800', marginBottom: Spacing.half },
  subtitle: { fontSize: 15, lineHeight: 22 },
  tabContainer: { flexDirection: 'row', borderRadius: BorderRadius.xlarge, borderWidth: 1, padding: 4, marginBottom: Spacing.three },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.large, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  listSection: { width: '100%' },
  reqRefBadge: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, marginLeft: 2 },
});
