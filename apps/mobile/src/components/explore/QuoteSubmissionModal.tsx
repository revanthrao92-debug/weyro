import React, { useState } from 'react';
import { Modal, StyleSheet, TextInput, View, Pressable, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DamageBroadcastRequest } from '@/services/damage-request-store';

interface QuoteSubmissionModalProps {
  visible: boolean;
  request: DamageBroadcastRequest | null;
  onClose: () => void;
  onSubmit: (data: {
    estimatedCost: number;
    partCondition: 'OEM' | 'AFTERMARKET' | 'USED';
    eta: string;
    notes: string;
  }) => void;
}

const CONDITIONS: ('OEM' | 'AFTERMARKET' | 'USED')[] = ['OEM', 'AFTERMARKET', 'USED'];

export function QuoteSubmissionModal({
  visible,
  request,
  onClose,
  onSubmit,
}: QuoteSubmissionModalProps) {
  const theme = useTheme();
  const [costInput, setCostInput] = useState('');
  const [partCondition, setPartCondition] = useState<'OEM' | 'AFTERMARKET' | 'USED'>('OEM');
  const [etaInput, setEtaInput] = useState('1 - 2 business days');
  const [notesInput, setNotesInput] = useState('Genuine OEM component with 6-month fitment warranty.');

  if (!request) return null;

  const isTowing = request.category === 'TOWING';

  const handleSubmit = () => {
    if (!isTowing) {
      const cost = parseFloat(costInput);
      if (isNaN(cost) || cost <= 0) {
        Alert.alert('Invalid Amount', 'Please specify a valid quotation cost in INR (₹).');
        return;
      }
    }

    onSubmit({
      estimatedCost: isTowing
        ? request.towingEstimatedFare ?? 0
        : parseFloat(costInput),
      partCondition,
      eta: etaInput.trim() || '1 - 2 days',
      notes: notesInput.trim(),
    });
    setCostInput('');
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
            Submit Quotation Bid
          </ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textSecondary">
            {request.damagedPart} • {request.vehicleMake} {request.vehicleModel}
          </ThemedText>

          {isTowing ? (
            <View
              style={[
                styles.towingNotice,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}>
              <ThemedText style={styles.towingTitle} themeColor="textSecondary">
                Distance-based towing fare
              </ThemedText>
              <ThemedText style={[styles.towingFare, { color: theme.primary }]}>
                {request.towingDistanceKm !== undefined
                  ? `${request.towingDistanceKm.toFixed(1)} km · ~₹${(
                      request.towingEstimatedFare ?? 0
                    ).toLocaleString('en-IN')} platform estimate`
                  : 'Platform estimate pending distance'}
              </ThemedText>
              <ThemedText style={styles.towingHint} themeColor="textSecondary">
                Your registered base + per-km tariff is applied automatically.
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={styles.label}>Quoted Total Cost (₹ INR)</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={costInput}
                onChangeText={setCostInput}
                keyboardType="numeric"
                placeholder="e.g. 4500"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Quoted total cost in Indian rupees"
              />

              <ThemedText style={styles.label}>Component Condition</ThemedText>
              <View style={styles.chipsRow} accessibilityRole="radiogroup">
                {CONDITIONS.map((cond) => {
                  const isSelected = partCondition === cond;
                  return (
                    <Pressable
                      key={cond}
                      onPress={() => setPartCondition(cond)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${cond} condition`}
                      style={[
                        styles.chip,
                        { borderColor: isSelected ? theme.primary : theme.border },
                        isSelected && { backgroundColor: theme.primarySurface },
                      ]}>
                      <ThemedText
                        style={[
                          styles.chipText,
                          isSelected && { color: theme.primary, fontWeight: '700' },
                        ]}>
                        {cond}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <ThemedText style={styles.label}>Estimated Delivery / Fitment Turnaround</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={etaInput}
            onChangeText={setEtaInput}
            placeholder="e.g. Same day, 2 days"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Estimated delivery or fitment turnaround"
          />

          <ThemedText style={styles.label}>Notes / Warranty</ThemedText>
          <TextInput
            style={[styles.textArea, { borderColor: theme.border, color: theme.text }]}
            value={notesInput}
            onChangeText={setNotesInput}
            multiline
            numberOfLines={2}
            placeholder="Specify fitment notes, courier tracking, or warranty terms..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Quotation notes and warranty terms"
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel quotation"
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Dispatch quotation"
              style={[styles.btn, styles.submitBtn, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.submitText, { color: theme.inverseText }]}>Dispatch Quote</ThemedText>
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
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
    marginBottom: Spacing.two,
  },
  textArea: {
    height: 60,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontSize: 13,
    marginBottom: Spacing.two,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12,
  },
  towingNotice: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    marginBottom: Spacing.two,
    gap: 2,
  },
  towingTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  towingFare: {
    fontSize: 14,
    fontWeight: '800',
  },
  towingHint: {
    fontSize: 11,
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
