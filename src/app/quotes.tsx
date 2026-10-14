import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BookingMilestoneStatus,
  BookingRecord,
  DamageBroadcastRequest,
  DamageRequestQuote,
  damageRequestStore,
  useBookings,
  useDamageRequests,
} from '@/services/damage-request-store';

export default function QuotesAndBookingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();

  const requests = useDamageRequests();
  const bookings = useBookings();

  const [activeTab, setActiveTab] = useState<'QUOTES' | 'BOOKINGS'>('QUOTES');

  // Review & Milestone State
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

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

  const handleSubmitReview = (bookingId: string) => {
    const rating = reviewRatings[bookingId] || 5;
    const comment = reviewComments[bookingId] || '';
    if (!comment.trim()) {
      Alert.alert(
        'Review Note Required',
        'Please provide a brief comment on the part condition or repair quality.'
      );
      return;
    }
    damageRequestStore.addBookingReview(bookingId, rating, comment);
    Alert.alert(
      'Review Published ⭐',
      'Thank you! Your verified rating helps build trust across the Weyro network.'
    );
  };

  const getMilestoneIndex = (status: BookingMilestoneStatus): number => {
    switch (status) {
      case 'CONFIRMED':
        return 1;
      case 'DISPATCHED_OR_IN_BAY':
        return 2;
      case 'OUT_FOR_DELIVERY_OR_TESTING':
        return 3;
      case 'COMPLETED':
        return 4;
    }
  };

  const getNextStageLabel = (booking: BookingRecord): string => {
    const isShipping = booking.fulfillmentType === 'PARTS_SHIPPING';
    switch (booking.status) {
      case 'CONFIRMED':
        return isShipping ? 'Dispatch via Courier' : 'Check Into Workshop Bay';
      case 'DISPATCHED_OR_IN_BAY':
        return isShipping ? 'Out for Delivery' : 'Road Test & Paint Check';
      case 'OUT_FOR_DELIVERY_OR_TESTING':
        return 'Sign Off & Complete';
      default:
        return 'Completed';
    }
  };

  const [selectedRequest, setSelectedRequest] = useState<DamageBroadcastRequest | null>(
    null
  );
  const [selectedQuote, setSelectedQuote] = useState<DamageRequestQuote | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('742 Evergreen Terrace, Springfield');
  const [scheduledDate, setScheduledDate] = useState('Tomorrow, 10:00 AM');

  const handleOpenBookingModal = (
    req: DamageBroadcastRequest,
    quote: DamageRequestQuote
  ) => {
    setSelectedRequest(req);
    setSelectedQuote(quote);
  };

  const handleConfirmBooking = () => {
    if (!selectedRequest || !selectedQuote) return;

    if (!deliveryAddress.trim()) {
      Alert.alert('Missing Address', 'Please provide delivery address or drop-off workshop.');
      return;
    }

    damageRequestStore.acceptQuote(selectedRequest.id, selectedQuote.id, {
      deliveryAddress: deliveryAddress.trim(),
      scheduledDate: scheduledDate.trim() || 'Immediate / Next Available',
    });

    Alert.alert(
      'Booking Confirmed! 🎉',
      `You accepted the quotation from ${selectedQuote.providerName}. The provider has been notified.`
    );

    setSelectedRequest(null);
    setSelectedQuote(null);
    setActiveTab('BOOKINGS');
  };

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <ThemedText style={styles.statusBadgeText}>
                CUSTOMER MARKETPLACE • DIRECT BOOKING
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Quotes & Bookings
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
              Compare competing quotes from verified mechanics and spare-parts dealers
              nationwide, then accept and confirm your booking.
            </ThemedText>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabSwitcher}>
            <Pressable
              onPress={() => setActiveTab('QUOTES')}
              style={[
                styles.tabSwitchButton,
                activeTab === 'QUOTES' && styles.tabSwitchButtonActive,
              ]}>
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabSwitchText,
                  activeTab === 'QUOTES' && styles.tabSwitchTextActive,
                ]}>
                Active Quotes (
                {requests.reduce((acc, r) => acc + r.quotes.length, 0)})
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('BOOKINGS')}
              style={[
                styles.tabSwitchButton,
                activeTab === 'BOOKINGS' && styles.tabSwitchButtonActive,
              ]}>
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabSwitchText,
                  activeTab === 'BOOKINGS' && styles.tabSwitchTextActive,
                ]}>
                Confirmed Bookings ({bookings.length})
              </ThemedText>
            </Pressable>
          </View>

          {/* QUOTES VIEW */}
          {activeTab === 'QUOTES' && (
            <View style={styles.listContainer}>
              {requests.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText style={styles.emptyIcon}>📋</ThemedText>
                  <ThemedText type="smallBold">No Active Damage Requests</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Post a car damage photo to broadcast and receive quotes from dealers.
                  </ThemedText>
                  <Pressable
                    onPress={() => router.push('/')}
                    style={styles.emptyActionButton}>
                    <ThemedText style={styles.emptyActionButtonText}>
                      Post Damage Request
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ) : (
                requests.map((req) => (
                  <ThemedView
                    key={req.id}
                    type="backgroundElement"
                    style={styles.requestGroupCard}>
                    {/* Request Header Summary */}
                    <View style={styles.requestCardTop}>
                      <View style={styles.requestThumbWrapper}>
                        {req.damagePhotos && req.damagePhotos.length > 0 ? (
                          <Image
                            source={{ uri: req.damagePhotos[0] }}
                            style={styles.requestThumb}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.noPhotoPlaceholder}>
                            <ThemedText>🚗</ThemedText>
                          </View>
                        )}
                      </View>

                      <View style={styles.requestTopInfo}>
                        <View style={styles.broadcastScopeBadge}>
                          <ThemedText style={styles.broadcastScopeText}>
                            📡 NATIONWIDE BROADCAST
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={styles.partHeaderTitle}>
                          {req.damagedPart}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {req.vehicleYear} {req.vehicleMake} {req.vehicleModel}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Fulfillment: {req.fulfillmentType.replace('_', ' ')}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Quotations List */}
                    <View style={styles.quotesSection}>
                      <View style={styles.quotesSectionHeader}>
                        <ThemedText type="smallBold">
                          Competing Offers ({req.quotes.length})
                        </ThemedText>
                        {req.status === 'ACCEPTED' && (
                          <View style={styles.acceptedTag}>
                            <ThemedText style={styles.acceptedTagText}>
                              ✓ QUOTE ACCEPTED
                            </ThemedText>
                          </View>
                        )}
                      </View>

                      {req.quotes.length === 0 ? (
                        <ThemedView
                          type="backgroundSelected"
                          style={styles.noQuotesBox}>
                          <ThemedText type="small" themeColor="textSecondary">
                            ⏳ Broadcasting to mechanics & spare parts dealers... Incoming
                            quotes will appear here.
                          </ThemedText>
                        </ThemedView>
                      ) : (
                        req.quotes.map((quote) => {
                          const isAccepted = quote.status === 'ACCEPTED';
                          const isRejected = quote.status === 'REJECTED';

                          return (
                            <View
                              key={quote.id}
                              style={[
                                styles.quoteCard,
                                { backgroundColor: theme.background },
                                isAccepted && styles.quoteCardAccepted,
                              ]}>
                              <View style={styles.quoteHeaderRow}>
                                <View style={styles.providerInfoWrapper}>
                                  <ThemedText type="smallBold" style={styles.providerName}>
                                    {quote.providerName}
                                  </ThemedText>
                                  <ThemedText
                                    type="small"
                                    style={styles.providerTypeLabel}
                                    themeColor="textSecondary">
                                    {quote.providerType.replace('_', ' ')} •{' '}
                                    {quote.distanceNote}
                                  </ThemedText>
                                </View>

                                <View style={styles.priceContainer}>
                                  <ThemedText type="title" style={styles.priceValue}>
                                    ${quote.estimatedCost}
                                  </ThemedText>
                                </View>
                              </View>

                              {/* Specs row */}
                              <View style={styles.specsRow}>
                                {quote.partCondition && (
                                  <View style={styles.conditionPill}>
                                    <ThemedText style={styles.conditionPillText}>
                                      {quote.partCondition} Grade
                                    </ThemedText>
                                  </View>
                                )}
                                <View style={styles.etaPill}>
                                  <ThemedText style={styles.etaPillText}>
                                    ETA: {quote.eta}
                                  </ThemedText>
                                </View>
                              </View>

                              <ThemedText
                                type="small"
                                style={styles.quoteNotesText}
                                themeColor="textSecondary">
                                &ldquo;{quote.notes}&rdquo;
                              </ThemedText>

                              {/* Action buttons */}
                              <View style={styles.quoteActionsRow}>
                                <Pressable
                                  onPress={() =>
                                    router.push({
                                      pathname: '/chat',
                                      params: {
                                        requestId: req.id,
                                        providerName: quote.providerName,
                                        customerName: req.customerName,
                                        damagedPart: req.damagedPart,
                                        vehicle: `${req.vehicleYear} ${req.vehicleMake} ${req.vehicleModel}`,
                                        role: 'CUSTOMER',
                                      },
                                    })
                                  }
                                  style={({ pressed }) => [
                                    styles.chatButton,
                                    pressed && styles.buttonPressed,
                                  ]}>
                                  <ThemedText style={styles.chatButtonText}>
                                    💬 Chat with Provider
                                  </ThemedText>
                                </Pressable>

                                {req.status !== 'ACCEPTED' ? (
                                  <Pressable
                                    onPress={() => handleOpenBookingModal(req, quote)}
                                    style={({ pressed }) => [
                                      styles.acceptButton,
                                      pressed && styles.buttonPressed,
                                    ]}>
                                    <ThemedText style={styles.acceptButtonText}>
                                      Accept Quote & Book
                                    </ThemedText>
                                  </Pressable>
                                ) : isAccepted ? (
                                  <View style={styles.acceptedBanner}>
                                    <ThemedText style={styles.acceptedBannerText}>
                                      ✓ Quote Confirmed & Booked
                                    </ThemedText>
                                  </View>
                                ) : isRejected ? (
                                  <ThemedText
                                    type="small"
                                    style={styles.rejectedText}
                                    themeColor="textSecondary">
                                    Alternative offer (Request closed)
                                  </ThemedText>
                                ) : null}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </ThemedView>
                ))
              )}
            </View>
          )}

          {/* BOOKINGS VIEW */}
          {activeTab === 'BOOKINGS' && (
            <View style={styles.listContainer}>
              {bookings.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText style={styles.emptyIcon}>📦</ThemedText>
                  <ThemedText type="smallBold">No Confirmed Bookings Yet</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    When you accept a quote, delivery logistics and booking records
                    appear here.
                  </ThemedText>
                </ThemedView>
              ) : (
                bookings.map((b) => {
                  const stepIndex = getMilestoneIndex(b.status);
                  const isShipping = b.fulfillmentType === 'PARTS_SHIPPING';
                  const getStatusBadgeConfig = () => {
                    switch (b.status) {
                      case 'CONFIRMED':
                        return { text: '1. ORDER CONFIRMED', bg: '#059669' };
                      case 'DISPATCHED_OR_IN_BAY':
                        return {
                          text: isShipping ? '2. COURIER IN TRANSIT' : '2. IN WORKSHOP BAY',
                          bg: '#0F52BA',
                        };
                      case 'OUT_FOR_DELIVERY_OR_TESTING':
                        return {
                          text: isShipping ? '3. OUT FOR DELIVERY' : '3. ROAD TESTING & QA',
                          bg: '#D97706',
                        };
                      case 'COMPLETED':
                        return { text: '4. COMPLETED & SIGNED OFF', bg: '#059669' };
                    }
                  };
                  const badge = getStatusBadgeConfig();

                  return (
                    <ThemedView
                      key={b.id}
                      type="backgroundElement"
                      style={styles.bookingCard}>
                      <View style={styles.bookingTopRow}>
                        <View
                          style={[
                            styles.bookingStatusBadge,
                            { backgroundColor: badge.bg },
                          ]}>
                          <ThemedText style={styles.bookingStatusText}>
                            {badge.text}
                          </ThemedText>
                        </View>
                        <ThemedText type="title" style={styles.bookingCostText}>
                          ${b.totalCost}
                        </ThemedText>
                      </View>

                      <View style={styles.bookingInfoBlock}>
                        <ThemedText type="subtitle" style={styles.bookingTitle}>
                          {b.damagedPart}
                        </ThemedText>
                        <ThemedText type="smallBold" themeColor="textSecondary">
                          Vehicle: {b.vehicle}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.providerSummaryBox,
                          { backgroundColor: theme.background },
                        ]}>
                        <ThemedText type="smallBold">
                          Selected Provider: {b.providerName}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Category: {b.providerType.replace('_', ' ')} • Condition:{' '}
                          {b.partCondition || 'OEM'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Estimated Delivery / Arrival: {b.eta}
                        </ThemedText>
                      </View>

                      <View style={styles.deliveryDetailsBlock}>
                        <ThemedText type="smallBold">Delivery & Schedule</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          📍 Destination: {b.deliveryAddress}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          🕒 Schedule: {b.scheduledDate}
                        </ThemedText>
                      </View>

                      {/* Courier Waybill Tracking Card */}
                      {b.trackingNumber && (
                        <View
                          style={[
                            styles.waybillBox,
                            { backgroundColor: theme.background },
                          ]}>
                          <ThemedText style={styles.waybillIcon}>🚚</ThemedText>
                          <View style={{ flex: 1, gap: 2 }}>
                            <ThemedText type="smallBold" style={styles.waybillCarrier}>
                              {b.carrierName || 'Express Auto Freight'}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              Waybill Tracking: {b.trackingNumber}
                            </ThemedText>
                          </View>
                          <View style={styles.liveBadge}>
                            <ThemedText style={styles.liveBadgeText}>LIVE GPS</ThemedText>
                          </View>
                        </View>
                      )}

                      {/* 4-Step Progress Tracker */}
                      <View style={styles.trackerRow}>
                        <View
                          style={[
                            styles.trackerStep,
                            stepIndex >= 1 && styles.trackerStepActive,
                          ]}>
                          <ThemedText
                            style={
                              stepIndex >= 1
                                ? styles.trackerStepText
                                : styles.trackerStepTextInactive
                            }>
                            1. Confirmed
                          </ThemedText>
                        </View>
                        <View style={styles.trackerDivider} />
                        <View
                          style={[
                            styles.trackerStep,
                            stepIndex >= 2 && styles.trackerStepActive,
                          ]}>
                          <ThemedText
                            style={
                              stepIndex >= 2
                                ? styles.trackerStepText
                                : styles.trackerStepTextInactive
                            }>
                            {isShipping ? '2. In Transit' : '2. In Bay'}
                          </ThemedText>
                        </View>
                        <View style={styles.trackerDivider} />
                        <View
                          style={[
                            styles.trackerStep,
                            stepIndex >= 3 && styles.trackerStepActive,
                          ]}>
                          <ThemedText
                            style={
                              stepIndex >= 3
                                ? styles.trackerStepText
                                : styles.trackerStepTextInactive
                            }>
                            {isShipping ? '3. Out For Del' : '3. Road Test'}
                          </ThemedText>
                        </View>
                        <View style={styles.trackerDivider} />
                        <View
                          style={[
                            styles.trackerStep,
                            stepIndex >= 4 && styles.trackerStepActive,
                          ]}>
                          <ThemedText
                            style={
                              stepIndex >= 4
                                ? styles.trackerStepText
                                : styles.trackerStepTextInactive
                            }>
                            4. Complete
                          </ThemedText>
                        </View>
                      </View>

                      {/* Provider Advance Stage Simulator Button */}
                      {b.status !== 'COMPLETED' && (
                        <Pressable
                          onPress={() => handleAdvanceMilestone(b)}
                          style={({ pressed }) => [
                            styles.advanceStageButton,
                            pressed && styles.buttonPressed,
                          ]}>
                          <ThemedText style={styles.advanceStageButtonText}>
                            Advance Stage ➔ {getNextStageLabel(b)} (Simulate)
                          </ThemedText>
                        </Pressable>
                      )}

                      {/* Message Provider Action */}
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/chat',
                            params: {
                              requestId: b.requestId,
                              providerName: b.providerName,
                              customerName: b.customerName,
                              damagedPart: b.damagedPart,
                              vehicle: b.vehicle,
                              role: 'CUSTOMER',
                            },
                          })
                        }
                        style={({ pressed }) => [
                          styles.chatButton,
                          pressed && styles.buttonPressed,
                        ]}>
                        <ThemedText style={styles.chatButtonText}>
                          💬 Message Provider Regarding Booking
                        </ThemedText>
                      </Pressable>

                      {/* Interactive 5-Star Customer Review Card */}
                      {b.status === 'COMPLETED' && (
                        <View
                          style={[
                            styles.reviewContainer,
                            { backgroundColor: theme.background },
                          ]}>
                          {b.review ? (
                            <View style={styles.reviewPublishedBox}>
                              <View style={styles.reviewHeaderRow}>
                                <ThemedText type="smallBold">
                                  ⭐ Verified Customer Review
                                </ThemedText>
                                <ThemedText style={styles.starsRow}>
                                  {'⭐'.repeat(b.review.rating)} ({b.review.rating}/5)
                                </ThemedText>
                              </View>
                              <ThemedText type="small" style={styles.reviewCommentText}>
                                &ldquo;{b.review.comment}&rdquo;
                              </ThemedText>
                              <ThemedText
                                type="small"
                                themeColor="textSecondary"
                                style={{ fontSize: 11 }}>
                                Published on{' '}
                                {new Date(b.review.createdAt).toLocaleDateString()}
                              </ThemedText>
                            </View>
                          ) : (
                            <View style={styles.reviewInputBox}>
                              <ThemedText type="smallBold">
                                Rate & Review Service
                              </ThemedText>
                              <ThemedText type="small" themeColor="textSecondary">
                                How was your experience with {b.providerName}?
                              </ThemedText>

                              <View style={styles.starPickerRow}>
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const currentRating = reviewRatings[b.id] ?? 5;
                                  const isSelected = star <= currentRating;
                                  return (
                                    <Pressable
                                      key={star}
                                      onPress={() =>
                                        setReviewRatings((prev) => ({
                                          ...prev,
                                          [b.id]: star,
                                        }))
                                      }
                                      style={styles.starButton}>
                                      <ThemedText
                                        style={{
                                          fontSize: 24,
                                          opacity: isSelected ? 1 : 0.3,
                                        }}>
                                        ⭐
                                      </ThemedText>
                                    </Pressable>
                                  );
                                })}
                                <ThemedText
                                  type="smallBold"
                                  style={{ marginLeft: 8 }}>
                                  {reviewRatings[b.id] ?? 5}/5
                                </ThemedText>
                              </View>

                              <TextInput
                                value={reviewComments[b.id] || ''}
                                onChangeText={(text) =>
                                  setReviewComments((prev) => ({
                                    ...prev,
                                    [b.id]: text,
                                  }))
                                }
                                placeholder="Describe fitment accuracy, delivery speed, and overall service..."
                                placeholderTextColor={theme.textSecondary}
                                multiline
                                numberOfLines={3}
                                style={[
                                  styles.reviewTextInput,
                                  {
                                    color: theme.text,
                                    backgroundColor: theme.backgroundElement,
                                    borderColor: theme.textSecondary,
                                  },
                                ]}
                              />

                              <Pressable
                                onPress={() => handleSubmitReview(b.id)}
                                style={({ pressed }) => [
                                  styles.submitReviewButton,
                                  pressed && styles.buttonPressed,
                                ]}>
                                <ThemedText style={styles.submitReviewButtonText}>
                                  Submit 5-Star Rating & Review
                                </ThemedText>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      )}
                    </ThemedView>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Acceptance Modal */}
      <Modal
        visible={!!selectedRequest && !!selectedQuote}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setSelectedRequest(null);
          setSelectedQuote(null);
        }}>
        <View style={styles.modalOverlay}>
          <ThemedView
            type="backgroundElement"
            style={[
              styles.modalContainer,
              {
                paddingBottom: safeAreaInsets.bottom + Spacing.three,
              },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Confirm Quote & Booking
              </ThemedText>
              <Pressable
                onPress={() => {
                  setSelectedRequest(null);
                  setSelectedQuote(null);
                }}
                style={styles.closeModalButton}>
                <ThemedText type="smallBold">✕</ThemedText>
              </Pressable>
            </View>

            {selectedQuote && selectedRequest && (
              <ScrollView style={styles.modalBody}>
                {/* Summary Card */}
                <View
                  style={[
                    styles.modalSummaryBox,
                    { backgroundColor: theme.background },
                  ]}>
                  <ThemedText type="smallBold" style={styles.modalProviderTitle}>
                    {selectedQuote.providerName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {selectedRequest.vehicleYear} {selectedRequest.vehicleMake} •{' '}
                    {selectedRequest.damagedPart}
                  </ThemedText>
                  <ThemedText type="title" style={styles.modalPriceText}>
                    ${selectedQuote.estimatedCost}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Delivery ETA: {selectedQuote.eta}
                  </ThemedText>
                </View>

                {/* Form fields */}
                <View style={styles.modalFieldGroup}>
                  <ThemedText type="smallBold">
                    Delivery Address / Drop-off Workshop
                  </ThemedText>
                  <TextInput
                    value={deliveryAddress}
                    onChangeText={setDeliveryAddress}
                    placeholder="Enter street address or workshop"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.modalInput,
                      {
                        color: theme.text,
                        backgroundColor: theme.background,
                        borderColor: theme.textSecondary,
                      },
                    ]}
                  />
                </View>

                <View style={styles.modalFieldGroup}>
                  <ThemedText type="smallBold">Preferred Date / Timing</ThemedText>
                  <TextInput
                    value={scheduledDate}
                    onChangeText={setScheduledDate}
                    placeholder="e.g. Tomorrow at 10:00 AM"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.modalInput,
                      {
                        color: theme.text,
                        backgroundColor: theme.background,
                        borderColor: theme.textSecondary,
                      },
                    ]}
                  />
                </View>

                {/* Guarantee Note */}
                <View style={styles.modalGuaranteeBanner}>
                  <ThemedText style={styles.modalGuaranteeText}>
                    🔒 Escrow Protection: Payment is authorized upon booking and
                    released only after part inspection or job completion.
                  </ThemedText>
                </View>

                <Pressable
                  onPress={handleConfirmBooking}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    pressed && styles.buttonPressed,
                  ]}>
                  <ThemedText style={styles.confirmButtonText}>
                    Confirm Booking (${selectedQuote.estimatedCost}) 🚀
                  </ThemedText>
                </Pressable>
              </ScrollView>
            )}
          </ThemedView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  statusBadge: {
    backgroundColor: '#059669',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabSwitchButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabSwitchButtonActive: {
    backgroundColor: '#0F52BA',
  },
  tabSwitchText: {
    fontSize: 13,
  },
  tabSwitchTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    gap: Spacing.four,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: 16,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyActionButton: {
    backgroundColor: '#0F52BA',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    marginTop: Spacing.one,
  },
  emptyActionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  requestGroupCard: {
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.three,
  },
  requestCardTop: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  requestThumbWrapper: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  requestThumb: {
    width: '100%',
    height: '100%',
  },
  noPhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  requestTopInfo: {
    flex: 1,
    gap: 2,
  },
  broadcastScopeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 82, 186, 0.15)',
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  broadcastScopeText: {
    color: '#0F52BA',
    fontSize: 10,
    fontWeight: '700',
  },
  partHeaderTitle: {
    fontSize: 16,
    lineHeight: 20,
  },
  quotesSection: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: Spacing.two,
  },
  quotesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  acceptedTag: {
    backgroundColor: '#059669',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  acceptedTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  noQuotesBox: {
    padding: Spacing.three,
    borderRadius: 10,
  },
  quoteCard: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },
  quoteCardAccepted: {
    borderColor: '#059669',
    borderWidth: 2,
  },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  providerInfoWrapper: {
    flex: 1,
    gap: 2,
  },
  providerName: {
    fontSize: 15,
  },
  providerTypeLabel: {
    fontSize: 12,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#059669',
    lineHeight: 26,
  },
  specsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  conditionPill: {
    backgroundColor: 'rgba(15, 82, 186, 0.15)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  conditionPillText: {
    color: '#0F52BA',
    fontSize: 11,
    fontWeight: '600',
  },
  etaPill: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  etaPillText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '600',
  },
  quoteNotesText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  quoteActionsRow: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chatButton: {
    borderWidth: 1,
    borderColor: '#0F52BA',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#0F52BA',
    fontWeight: '700',
    fontSize: 13,
  },
  acceptButton: {
    backgroundColor: '#0F52BA',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  acceptedBanner: {
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    paddingVertical: Spacing.one,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptedBannerText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13,
  },
  rejectedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  bookingCard: {
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.three,
  },
  bookingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingStatusBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bookingStatusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  bookingCostText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#059669',
  },
  bookingInfoBlock: {
    gap: 2,
  },
  bookingTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  providerSummaryBox: {
    padding: Spacing.two,
    borderRadius: 10,
    gap: 2,
  },
  deliveryDetailsBlock: {
    gap: 2,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  trackerStep: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  trackerStepActive: {
    backgroundColor: '#059669',
  },
  trackerStepText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  trackerStepTextInactive: {
    fontSize: 11,
    color: '#888888',
  },
  trackerDivider: {
    width: 10,
    height: 2,
    backgroundColor: '#cccccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    maxHeight: '85%',
    gap: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeModalButton: {
    padding: Spacing.one,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalSummaryBox: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: 4,
    marginBottom: Spacing.two,
  },
  modalProviderTitle: {
    fontSize: 16,
  },
  modalPriceText: {
    fontSize: 26,
    color: '#059669',
    fontWeight: '700',
  },
  modalFieldGroup: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  modalGuaranteeBanner: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    padding: Spacing.two,
    borderRadius: 10,
    marginBottom: Spacing.three,
  },
  modalGuaranteeText: {
    fontSize: 12,
    color: '#059669',
    lineHeight: 16,
  },
  confirmButton: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  waybillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(15, 82, 186, 0.3)',
  },
  waybillIcon: {
    fontSize: 22,
  },
  waybillCarrier: {
    fontSize: 13,
  },
  liveBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    paddingHorizontal: Spacing.one,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  advanceStageButton: {
    backgroundColor: '#0F52BA',
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceStageButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewContainer: {
    padding: Spacing.two,
    borderRadius: 12,
    marginTop: Spacing.one,
  },
  reviewPublishedBox: {
    gap: 4,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  starsRow: {
    fontSize: 14,
  },
  reviewCommentText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reviewInputBox: {
    gap: Spacing.one,
  },
  starPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  starButton: {
    padding: 2,
  },
  reviewTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submitReviewButton: {
    backgroundColor: '#059669',
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitReviewButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
