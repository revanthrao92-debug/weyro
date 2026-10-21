import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DamageBroadcastRequest,
  damageRequestStore,
  useDamageRequests,
} from '@/services/damage-request-store';
import { useAuth } from '@/services/auth-store';
import { FeedStatsHeader } from '@/components/explore/FeedStatsHeader';
import { BroadcastRequestCard } from '@/components/explore/BroadcastRequestCard';
import { QuoteSubmissionModal } from '@/components/explore/QuoteSubmissionModal';

export default function ProviderFeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const auth = useAuth();
  const requests = useDamageRequests();

  const [activeRequest, setActiveRequest] = useState<DamageBroadcastRequest | null>(null);

  const openRequests = requests.filter((r) => r.status === 'OPEN' || r.status === 'QUOTES_RECEIVED');

  const handleQuoteSubmit = (data: {
    estimatedCost: number;
    partCondition: 'OEM' | 'AFTERMARKET' | 'USED';
    eta: string;
    notes: string;
  }) => {
    if (!activeRequest) return;

    damageRequestStore.submitQuote(activeRequest.id, {
      providerName: auth.user?.name || 'Verified Workshop Partner',
      providerType: 'GARAGE',
      estimatedCost: data.estimatedCost,
      partCondition: data.partCondition,
      eta: data.eta,
      notes: data.notes,
    });

    setActiveRequest(null);
    Alert.alert(
      'Quote Dispatched! 🚀',
      `Your bid of ₹${data.estimatedCost.toLocaleString('en-IN')} has been delivered to the customer.`,
    );
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
          <FeedStatsHeader
            totalRequests={requests.length}
            openRequests={openRequests.length}
          />

          {openRequests.length === 0 ? (
            <View style={[styles.emptyCard, { borderColor: theme.border }]}>
              <ThemedText style={styles.emptyTitle}>Feed Clear</ThemedText>
              <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
                There are no pending broadcast requests in your service radius right now. New vehicle damage requests will stream here live.
              </ThemedText>
            </View>
          ) : (
            openRequests.map((req) => (
              <BroadcastRequestCard
                key={req.id}
                request={req}
                onOpenQuoteModal={() => setActiveRequest(req)}
                onOpenChat={() =>
                  router.push(
                    `/chat?requestId=${req.id}&customerName=${encodeURIComponent(req.customerName)}&role=PROVIDER`,
                  )
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      <QuoteSubmissionModal
        visible={Boolean(activeRequest)}
        request={activeRequest}
        onClose={() => setActiveRequest(null)}
        onSubmit={handleQuoteSubmit}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.four,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});
