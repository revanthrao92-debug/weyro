import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DamageBroadcastRequest } from '@/services/damage-request-store';

interface BroadcastRequestCardProps {
  request: DamageBroadcastRequest;
  onOpenQuoteModal: () => void;
  onOpenChat: () => void;
}

export function BroadcastRequestCard({
  request,
  onOpenQuoteModal,
  onOpenChat,
}: BroadcastRequestCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.topRow}>
        <View style={styles.vehicleInfo}>
          <ThemedText type="smallBold" style={styles.partTitle}>
            {request.damagedPart}
          </ThemedText>
          <ThemedText style={styles.vehicleSubtitle} themeColor="textSecondary">
            {request.vehicleYear} {request.vehicleMake} {request.vehicleModel}
          </ThemedText>
        </View>
        <View
          style={[
            styles.urgencyBadge,
            {
              backgroundColor:
                request.urgency === 'EMERGENCY'
                  ? theme.dangerSurface
                  : request.urgency === 'URGENT'
                  ? theme.warningSurface
                  : theme.successSurface,
            },
          ]}>
          <ThemedText
            style={[
              styles.urgencyText,
              {
                color:
                  request.urgency === 'EMERGENCY'
                    ? theme.danger
                    : request.urgency === 'URGENT'
                    ? theme.warning
                    : theme.success,
              },
            ]}>
            {request.urgency}
          </ThemedText>
        </View>
      </View>

      {Boolean(request.damagePhotos?.[0]) && (
        <Image
          source={{ uri: request.damagePhotos[0] }}
          style={styles.thumbnail}
          contentFit="cover"
          accessible
          accessibilityLabel={`Damage photo for ${request.damagedPart}`}
        />
      )}

      <ThemedText style={styles.description} numberOfLines={2} themeColor="textSecondary">
        {request.description}
      </ThemedText>

      <View style={[styles.metaRow, { borderColor: theme.border }]}>
        <ThemedText style={styles.metaText}>
          Fulfillment: <ThemedText type="smallBold">{request.fulfillmentType.replace(/_/g, ' ')}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.metaText}>
          Quotes: <ThemedText type="smallBold">{request.quotes.length}</ThemedText>
        </ThemedText>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onOpenChat}
          accessibilityRole="button"
          accessibilityLabel={`Chat with customer about ${request.damagedPart}`}
          style={[styles.chatBtn, { borderColor: theme.border }]}>
          <ThemedText style={styles.chatBtnText}>💬 Chat Customer</ThemedText>
        </Pressable>
        <Pressable
          onPress={onOpenQuoteModal}
          accessibilityRole="button"
          accessibilityLabel={`Send a quotation for ${request.damagedPart}`}
          style={[styles.quoteBtn, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.quoteBtnText, { color: theme.inverseText }]}>+ Send Quotation</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
    marginBottom: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  vehicleInfo: {
    flex: 1,
  },
  partTitle: {
    fontSize: 16,
  },
  vehicleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '800',
  },
  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginVertical: Spacing.one,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: Spacing.two,
  },
  metaText: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chatBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  chatBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quoteBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quoteBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
