import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DamageRequestQuote } from '@/services/damage-request-store';

interface AcceptQuoteModalProps {
  visible: boolean;
  quote: DamageRequestQuote | null;
  onClose: () => void;
  onConfirm: (address: string, date: string) => void;
}

function defaultServiceDate(): string {
  const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

export function AcceptQuoteModal({
  visible,
  quote,
  onClose,
  onConfirm,
}: AcceptQuoteModalProps) {
  const theme = useTheme();
  const [address, setAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState(defaultServiceDate);

  if (!quote) return null;

  const handleConfirm = () => {
    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 5) {
      Alert.alert(
        'Address Required',
        'Enter the doorstep address or workshop dropoff location.',
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate.trim())) {
      Alert.alert('Invalid Date', 'Use the YYYY-MM-DD format for the service date.');
      return;
    }

    onConfirm(trimmedAddress, scheduledDate.trim());
  };

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
            Accept Quotation & Confirm Booking
          </ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textSecondary">
            {quote.providerName} • ₹{quote.estimatedCost.toLocaleString('en-IN')}
          </ThemedText>

          <ThemedText style={styles.label}>Delivery / Fitment Address</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={address}
            onChangeText={setAddress}
            placeholder="Doorstep address or workshop dropoff"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Delivery or fitment address"
          />

          <ThemedText style={styles.label}>Target Service Date (YYYY-MM-DD)</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={scheduledDate}
            onChangeText={setScheduledDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Target service date, format year month day"
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel accepting quote"
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm and book this quote"
              style={[styles.btn, styles.confirmBtn, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.confirmText, { color: theme.inverseText }]}>Confirm & Book</ThemedText>
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
    marginBottom: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
    marginBottom: Spacing.two,
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
  confirmBtn: {},
  confirmText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
