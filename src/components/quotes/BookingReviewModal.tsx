import React, { useState } from 'react';
import { Modal, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BookingRecord } from '@/services/damage-request-store';

interface BookingReviewModalProps {
  visible: boolean;
  booking: BookingRecord | null;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}

export function BookingReviewModal({
  visible,
  booking,
  onClose,
  onSubmit,
}: BookingReviewModalProps) {
  const theme = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('Excellent fitment, genuine quality part.');

  if (!booking) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">
            Rate Your Repair & Service
          </ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textSecondary">
            {booking.providerName} • {booking.damagedPart}
          </ThemedText>

          <ThemedText style={styles.label}>Rating</ThemedText>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${star} out of 5`}
                accessibilityState={{ selected: star === rating }}
                style={styles.starBtn}>
                <ThemedText style={[styles.starText, { opacity: star <= rating ? 1 : 0.25 }]}>
                  ⭐
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={styles.label}>Review Feedback</ThemedText>
          <TextInput
            style={[styles.textArea, { borderColor: theme.border, color: theme.text }]}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            placeholder="Feedback on part condition, fitment, or workshop turnaround..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Review feedback"
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close review"
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.cancelText}>Close</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(rating, comment)}
              accessibilityRole="button"
              accessibilityLabel="Submit review"
              style={[styles.btn, styles.submitBtn, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.submitText, { color: theme.inverseText }]}>Submit Review</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: Spacing.two,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.two,
  },
  starBtn: {
    padding: 4,
  },
  starText: {
    fontSize: 24,
  },
  textArea: {
    height: 70,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontSize: 13,
    marginBottom: Spacing.two,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {},
  submitText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
