import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DamageRequestQuote } from '@/services/damage-request-store';

interface QuoteCardProps {
  quote: DamageRequestQuote;
  onAccept: () => void;
  onChat: () => void;
}

export function QuoteCard({ quote, onAccept, onChat }: QuoteCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }, Elevation.low, { borderRadius: BorderRadius.large }]}>
      <View style={styles.headerRow}>
        <View style={styles.providerInfo}>
          <ThemedText type="smallBold" style={styles.providerName}>
            {quote.providerName}
          </ThemedText>
          <ThemedText style={styles.distanceNote} themeColor="textSecondary">
            {quote.distanceNote}
          </ThemedText>
        </View>
        <View style={styles.priceContainer}>
          <ThemedText style={[styles.priceText, { color: theme.primary }]}>
            ₹{quote.estimatedCost.toLocaleString('en-IN')}
          </ThemedText>
          {quote.partCondition && (
            <View style={[styles.conditionBadge, { backgroundColor: theme.primarySurface }]}>
              <ThemedText style={[styles.conditionText, { color: theme.primary }]}>
                {quote.partCondition}
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.detailsRow}>
        <ThemedText style={styles.etaText}>
          ⏱️ ETA: <ThemedText type="smallBold">{quote.eta}</ThemedText>
        </ThemedText>
      </View>

      {Boolean(quote.notes) && (
        <ThemedText style={styles.notesText} themeColor="textSecondary">
          &ldquo;{quote.notes}&rdquo;
        </ThemedText>
      )}

      <View style={styles.actionRow}>
        <Pressable
          onPress={onChat}
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${quote.providerName}`}
          style={[styles.chatButton, { borderColor: theme.border }]}>
          <ThemedText style={styles.chatButtonText}>💬 Chat</ThemedText>
        </Pressable>

        {quote.status === 'PENDING' ? (
          <Pressable
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel={`Accept quote from ${quote.providerName} for ${quote.estimatedCost} rupees`}
            style={[styles.acceptButton, { backgroundColor: theme.primary }]}>
            <ThemedText style={[styles.acceptButtonText, { color: theme.inverseText }]}>Accept Quote & Book</ThemedText>
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityLabel={`Quote ${quote.status.toLowerCase()}`}
            style={[styles.statusBadge, { backgroundColor: quote.status === 'ACCEPTED' ? theme.successSurface : theme.dangerSurface }]}>
            <ThemedText style={{ color: quote.status === 'ACCEPTED' ? theme.success : theme.danger, fontWeight: '700', fontSize: 12 }}>
              {quote.status}
            </ThemedText>
          </View>
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
    marginBottom: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.one,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
  },
  distanceNote: {
    fontSize: 12,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
  },
  conditionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  etaText: {
    fontSize: 12,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  chatButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
});
