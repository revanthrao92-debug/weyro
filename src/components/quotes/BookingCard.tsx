import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BookingRecord, BookingMilestoneStatus } from '@/services/damage-request-store';

interface BookingCardProps {
  booking: BookingRecord;
  onAdvanceMilestone: () => void;
  onOpenReview: () => void;
  onChat: () => void;
}

const MILESTONE_STEPS: { key: BookingMilestoneStatus; label: string }[] = [
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'DISPATCHED_OR_IN_BAY', label: 'Dispatched / In Bay' },
  { key: 'OUT_FOR_DELIVERY_OR_TESTING', label: 'Delivery / Test' },
  { key: 'COMPLETED', label: 'Completed' },
];

function getMilestoneIndex(status: BookingMilestoneStatus): number {
  switch (status) {
    case 'CONFIRMED':
      return 0;
    case 'DISPATCHED_OR_IN_BAY':
      return 1;
    case 'OUT_FOR_DELIVERY_OR_TESTING':
      return 2;
    case 'COMPLETED':
      return 3;
    default:
      return 0;
  }
}

export function BookingCard({
  booking,
  onAdvanceMilestone,
  onOpenReview,
  onChat,
}: BookingCardProps) {
  const theme = useTheme();
  const currentIndex = getMilestoneIndex(booking.status);

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }, Elevation.low, { borderRadius: BorderRadius.large }]}>
      <View style={styles.header}>
        <View style={styles.vehicleInfo}>
          <ThemedText type="smallBold" style={styles.partTitle}>
            {booking.damagedPart}
          </ThemedText>
          <ThemedText style={styles.vehicleSubtitle} themeColor="textSecondary">
            {booking.vehicle} • {booking.customerName}
          </ThemedText>
        </View>
        <View style={styles.costBadge}>
          <ThemedText style={[styles.costText, { color: theme.primary }]}>
            ₹{booking.totalCost.toLocaleString('en-IN')}
          </ThemedText>
        </View>
      </View>

      <View style={styles.providerRow}>
        <ThemedText style={styles.providerLabel} themeColor="textSecondary">
          Partner: <ThemedText type="smallBold">{booking.providerName}</ThemedText>
        </ThemedText>
        {booking.trackingNumber && (
          <ThemedText style={[styles.trackingText, { color: theme.info }]}>
            Waybill: {booking.trackingNumber}
          </ThemedText>
        )}
      </View>

      {/* Stepper Progress */}
      <View style={[styles.stepperContainer, { borderColor: theme.border }]}>
        {MILESTONE_STEPS.map((step, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <View key={step.key} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: isDone ? theme.primary : theme.border },
                  isCurrent && styles.activeDot,
                ]}
              />
              <ThemedText
                style={[
                  styles.stepLabel,
                  isDone && { color: theme.primary, fontWeight: '700' },
                ]}>
                {step.label}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={onChat}
          style={[styles.smallBtn, { borderColor: theme.border }]}>
          <ThemedText style={styles.btnText}>💬 Chat</ThemedText>
        </Pressable>

        {booking.status !== 'COMPLETED' ? (
          <Pressable
            onPress={onAdvanceMilestone}
            style={[styles.advanceBtn, { backgroundColor: theme.primary }]}>
            <ThemedText style={[styles.advanceBtnText, { color: theme.inverseText }]}>Advance Milestone ➔</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={onOpenReview}
            style={[
              styles.reviewBtn,
              { backgroundColor: booking.review ? theme.successSurface : theme.primarySurface },
            ]}>
            <ThemedText
              style={{
                color: booking.review ? theme.success : theme.primary,
                fontWeight: '700',
                fontSize: 12,
              }}>
              {booking.review ? `⭐ ${booking.review.rating}/5 Rated` : '⭐ Leave Review'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 0,
    padding: Spacing.two,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  vehicleInfo: {
    flex: 1,
  },
  partTitle: {
    fontSize: 15,
  },
  vehicleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  costBadge: {
    alignItems: 'flex-end',
  },
  costText: {
    fontSize: 16,
    fontWeight: '800',
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  providerLabel: {
    fontSize: 12,
  },
  trackingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: Spacing.two,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  activeDot: {
    transform: [{ scale: 1.25 }],
  },
  stepLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  smallBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  advanceBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  advanceBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
});
