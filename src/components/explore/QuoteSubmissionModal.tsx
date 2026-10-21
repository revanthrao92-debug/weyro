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

  const handleSubmit = () => {
    const cost = parseFloat(costInput);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Invalid Amount', 'Please specify a valid quotation cost in INR (₹).');
      return;
    }

    onSubmit({
      estimatedCost: cost,
      partCondition,
      eta: etaInput.trim() || '1 - 2 days',
      notes: notesInput.trim(),
    });
    setCostInput('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.title}>
            Submit Quotation Bid
          </ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textSecondary">
            {request.damagedPart} • {request.vehicleMake} {request.vehicleModel}
          </ThemedText>

          <ThemedText style={styles.label}>Quoted Total Cost (₹ INR)</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={costInput}
            onChangeText={setCostInput}
            keyboardType="numeric"
            placeholder="e.g. 4500"
            placeholderTextColor={theme.textSecondary}
          />

          <ThemedText style={styles.label}>Component Condition</ThemedText>
          <View style={styles.chipsRow}>
            {CONDITIONS.map((cond) => {
              const isSelected = partCondition === cond;
              return (
                <Pressable
                  key={cond}
                  onPress={() => setPartCondition(cond)}
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

          <ThemedText style={styles.label}>Estimated Delivery / Fitment Turnaround</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={etaInput}
            onChangeText={setEtaInput}
            placeholder="e.g. Same day, 2 days"
            placeholderTextColor={theme.textSecondary}
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
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
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
