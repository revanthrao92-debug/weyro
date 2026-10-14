import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import {
  DamageBroadcastRequest,
  damageRequestStore,
  useDamageRequests,
} from '@/services/damage-request-store';

export default function ProviderFeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const requests = useDamageRequests();

  const [activeQuotingId, setActiveQuotingId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState('EuroParts & Repair Hub');
  const [providerType, setProviderType] = useState<'MECHANIC' | 'PARTS_DEALER' | 'GARAGE'>(
    'PARTS_DEALER'
  );
  const [distanceNote, setDistanceNote] = useState('85 km away • Insured Courier Dispatch');
  const [costInput, setCostInput] = useState('');
  const [partCondition, setPartCondition] = useState<'OEM' | 'AFTERMARKET' | 'USED'>('OEM');
  const [etaInput, setEtaInput] = useState('1 - 2 business days');
  const [notesInput, setNotesInput] = useState('');

  const handleOpenQuoteForm = (req: DamageBroadcastRequest) => {
    setActiveQuotingId(req.id === activeQuotingId ? null : req.id);
    setCostInput('');
    setNotesInput('');
  };

  const handleSendQuote = (requestId: string) => {
    const cost = parseFloat(costInput);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Invalid Cost', 'Please enter a valid estimate or part cost.');
      return;
    }

    damageRequestStore.addQuote(requestId, {
      providerName: providerName.trim() || 'Verified Provider',
      providerType,
      distanceNote,
      estimatedCost: cost,
      partCondition,
      eta: etaInput.trim() || '2 business days',
      notes: notesInput.trim() || 'Ready to dispatch or service immediately.',
    });

    Alert.alert('Quote Dispatched', 'Your quotation has been sent to the customer.');
    setActiveQuotingId(null);
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
            <View style={styles.providerBadge}>
              <ThemedText style={styles.providerBadgeText}>
                PROVIDER DASHBOARD • MECHANICS & DEALERS
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Damage Broadcast Feed
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
              Customers upload photos of damaged car parts. Requests are broadcast
              to mechanics and spare-parts dealers irrespective of distance or time.
            </ThemedText>
          </View>

          {/* Feed stats */}
          <View style={styles.statsRow}>
            <ThemedView type="backgroundElement" style={styles.statBox}>
              <ThemedText type="smallBold" style={styles.statValue}>
                {requests.length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Live Broadcasts
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.statBox}>
              <ThemedText type="smallBold" style={styles.statValue}>
                {requests.reduce((acc, r) => acc + r.quotes.length, 0)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Quotes Submitted
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.statBox}>
              <ThemedText type="smallBold" style={styles.statValue}>
                Unlimited
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Distance Scope
              </ThemedText>
            </ThemedView>
          </View>

          {/* Requests List */}
          {requests.map((req) => {
            const isQuoting = activeQuotingId === req.id;

            return (
              <ThemedView
                key={req.id}
                type="backgroundElement"
                style={styles.requestCard}>
                {/* Broadcast Banner */}
                <View style={styles.cardTopRow}>
                  <View style={styles.broadcastBannerPill}>
                    <ThemedText style={styles.broadcastBannerPillText}>
                      📡 BROADCAST • ALL DISTANCES & TIMES
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.urgencyBadge,
                      req.urgency === 'EMERGENCY' && styles.urgencyEmergency,
                      req.urgency === 'URGENT' && styles.urgencyUrgent,
                    ]}>
                    <ThemedText style={styles.urgencyText}>{req.urgency}</ThemedText>
                  </View>
                </View>

                {/* Main Vehicle & Part Title */}
                <View style={styles.cardHeaderInfo}>
                  <ThemedText type="title" style={styles.partTitle}>
                    {req.damagedPart}
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {req.vehicleYear} {req.vehicleMake} {req.vehicleModel} • Posted by{' '}
                    {req.customerName}
                  </ThemedText>
                </View>

                {/* Damage Photo (High Priority) */}
                {req.damagePhotos && req.damagePhotos.length > 0 && (
                  <View style={styles.photoContainer}>
                    <Image
                      source={{ uri: req.damagePhotos[0] }}
                      style={styles.damagePhoto}
                      contentFit="cover"
                    />
                    <View style={styles.photoOverlayBadge}>
                      <ThemedText style={styles.photoOverlayText}>
                        Customer Damage Photo
                      </ThemedText>
                    </View>
                  </View>
                )}

                {/* Description */}
                <View style={styles.descContainer}>
                  <ThemedText type="small" style={styles.descLabel} themeColor="textSecondary">
                    Damage Notes:
                  </ThemedText>
                  <ThemedText style={styles.descText}>{req.description}</ThemedText>
                </View>

                {/* Meta details */}
                <View style={styles.metaRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    📦 Fulfillment: {req.fulfillmentType.replace('_', ' ')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    💬 Quotes: {req.quotes.length}
                  </ThemedText>
                </View>

                {/* Action buttons */}
                <View style={styles.cardActionsRow}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/chat',
                        params: {
                          requestId: req.id,
                          providerName,
                          customerName: req.customerName,
                          damagedPart: req.damagedPart,
                          vehicle: `${req.vehicleYear} ${req.vehicleMake} ${req.vehicleModel}`,
                          role: 'PROVIDER',
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.chatWithCustomerButton,
                      pressed && styles.buttonPressed,
                    ]}>
                    <ThemedText style={styles.chatWithCustomerButtonText}>
                      💬 Message Customer
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => handleOpenQuoteForm(req)}
                    style={({ pressed }) => [
                      styles.quoteToggleButton,
                      isQuoting && styles.quoteToggleButtonActive,
                      pressed && styles.buttonPressed,
                    ]}>
                    <ThemedText style={styles.quoteToggleButtonText}>
                      {isQuoting
                        ? 'Close Quotation Form ▲'
                        : 'Send Quotation / Supply Part ▼'}
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Inline Quote Form */}
                {isQuoting && (
                  <View
                    style={[
                      styles.quoteFormContainer,
                      { backgroundColor: theme.background },
                    ]}>
                    <ThemedText type="smallBold" style={styles.formSectionTitle}>
                      Submit Quote / Availability
                    </ThemedText>

                    {/* Provider Type */}
                    <View style={styles.providerTypeRow}>
                      {(['PARTS_DEALER', 'MECHANIC', 'GARAGE'] as const).map(
                        (type) => (
                          <Pressable
                            key={type}
                            onPress={() => setProviderType(type)}
                            style={[
                              styles.typePill,
                              providerType === type && styles.typePillSelected,
                            ]}>
                            <ThemedText
                              type="small"
                              style={[
                                styles.typePillText,
                                providerType === type && styles.typePillTextSelected,
                              ]}>
                              {type.replace('_', ' ')}
                            </ThemedText>
                          </Pressable>
                        )
                      )}
                    </View>

                    {/* Provider Name & ETA */}
                    <View style={styles.formRow}>
                      <View style={[styles.formCol, { flex: 1 }]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Business / Shop Name
                        </ThemedText>
                        <TextInput
                          value={providerName}
                          onChangeText={setProviderName}
                          placeholder="e.g. EuroParts Hub"
                          placeholderTextColor={theme.textSecondary}
                          style={[
                            styles.quoteInput,
                            {
                              color: theme.text,
                              borderColor: theme.textSecondary,
                            },
                          ]}
                        />
                      </View>

                      <View style={[styles.formCol, { flex: 1 }]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Estimated ETA
                        </ThemedText>
                        <TextInput
                          value={etaInput}
                          onChangeText={setEtaInput}
                          placeholder="e.g. 1-2 days"
                          placeholderTextColor={theme.textSecondary}
                          style={[
                            styles.quoteInput,
                            {
                              color: theme.text,
                              borderColor: theme.textSecondary,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Cost & Part Condition */}
                    <View style={styles.formRow}>
                      <View style={[styles.formCol, { flex: 1 }]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Estimated Cost ($)
                        </ThemedText>
                        <TextInput
                          value={costInput}
                          onChangeText={setCostInput}
                          placeholder="e.g. 950"
                          keyboardType="numeric"
                          placeholderTextColor={theme.textSecondary}
                          style={[
                            styles.quoteInput,
                            {
                              color: theme.text,
                              borderColor: theme.textSecondary,
                            },
                          ]}
                        />
                      </View>

                      <View style={[styles.formCol, { flex: 1 }]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Part Condition
                        </ThemedText>
                        <View style={styles.conditionRow}>
                          {(['OEM', 'AFTERMARKET', 'USED'] as const).map((cond) => (
                            <Pressable
                              key={cond}
                              onPress={() => setPartCondition(cond)}
                              style={[
                                styles.condPill,
                                partCondition === cond && styles.condPillSelected,
                              ]}>
                              <ThemedText
                                type="small"
                                style={[
                                  styles.condPillText,
                                  partCondition === cond &&
                                    styles.condPillTextSelected,
                                ]}>
                                {cond}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>

                    {/* Distance / Dispatch Note */}
                    <View style={styles.formCol}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Location / Delivery Logistics
                      </ThemedText>
                      <TextInput
                        value={distanceNote}
                        onChangeText={setDistanceNote}
                        placeholder="e.g. 75 km away • Courier dispatch"
                        placeholderTextColor={theme.textSecondary}
                        style={[
                          styles.quoteInput,
                          {
                            color: theme.text,
                            borderColor: theme.textSecondary,
                          },
                        ]}
                      />
                    </View>

                    {/* Notes */}
                    <View style={styles.formCol}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Proposal Details & Part Availability
                      </ThemedText>
                      <TextInput
                        value={notesInput}
                        onChangeText={setNotesInput}
                        placeholder="e.g. In stock, matches VIN specs, ready to ship today."
                        placeholderTextColor={theme.textSecondary}
                        style={[
                          styles.quoteInput,
                          {
                            color: theme.text,
                            borderColor: theme.textSecondary,
                          },
                        ]}
                      />
                    </View>

                    <Pressable
                      onPress={() => handleSendQuote(req.id)}
                      style={({ pressed }) => [
                        styles.sendQuoteButton,
                        pressed && styles.buttonPressed,
                      ]}>
                      <ThemedText style={styles.sendQuoteButtonText}>
                        Dispatch Quote to Customer 📨
                      </ThemedText>
                    </Pressable>
                  </View>
                )}

                {/* Existing Quotes Display */}
                {req.quotes.length > 0 && (
                  <View style={styles.existingQuotesWrapper}>
                    <ThemedText type="smallBold" style={styles.existingQuotesTitle}>
                      Received Quotations ({req.quotes.length})
                    </ThemedText>

                    {req.quotes.map((q) => (
                      <View
                        key={q.id}
                        style={[
                          styles.quoteItemCard,
                          { backgroundColor: theme.background },
                        ]}>
                        <View style={styles.quoteItemTop}>
                          <View>
                            <ThemedText type="smallBold">
                              {q.providerName}
                            </ThemedText>
                            <ThemedText
                              type="small"
                              style={styles.quoteProviderType}
                              themeColor="textSecondary">
                              {q.providerType.replace('_', ' ')} • {q.distanceNote}
                            </ThemedText>
                          </View>
                          <ThemedText type="subtitle" style={styles.quoteCost}>
                            ${q.estimatedCost}
                          </ThemedText>
                        </View>

                        {q.partCondition && (
                          <View style={styles.partConditionBadge}>
                            <ThemedText style={styles.partConditionText}>
                              {q.partCondition} Condition • ETA: {q.eta}
                            </ThemedText>
                          </View>
                        )}

                        <ThemedText type="small" style={styles.quoteNotes}>
                          &ldquo;{q.notes}&rdquo;
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </ThemedView>
            );
          })}
        </View>
      </ScrollView>
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
  providerBadge: {
    backgroundColor: '#0F52BA',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  providerBadgeText: {
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statBox: {
    flex: 1,
    padding: Spacing.two,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#0F52BA',
  },
  requestCard: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  broadcastBannerPill: {
    backgroundColor: 'rgba(15, 82, 186, 0.15)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  broadcastBannerPillText: {
    color: '#0F52BA',
    fontSize: 11,
    fontWeight: '700',
  },
  urgencyBadge: {
    backgroundColor: '#60646C',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  urgencyUrgent: {
    backgroundColor: '#D97706',
  },
  urgencyEmergency: {
    backgroundColor: '#DC2626',
  },
  urgencyText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeaderInfo: {
    gap: Spacing.one,
  },
  partTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  damagePhoto: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: Spacing.two,
    left: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  photoOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  descContainer: {
    gap: Spacing.half,
  },
  descLabel: {
    fontSize: 12,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  cardActionsRow: {
    gap: Spacing.two,
  },
  chatWithCustomerButton: {
    borderWidth: 1,
    borderColor: '#0F52BA',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatWithCustomerButtonText: {
    color: '#0F52BA',
    fontWeight: '700',
    fontSize: 13,
  },
  quoteToggleButton: {
    backgroundColor: '#0F52BA',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteToggleButtonActive: {
    backgroundColor: '#333333',
  },
  quoteToggleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  quoteFormContainer: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  formSectionTitle: {
    fontSize: 14,
  },
  providerTypeRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  typePill: {
    flex: 1,
    paddingVertical: Spacing.one,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#60646C',
  },
  typePillSelected: {
    backgroundColor: '#0F52BA',
    borderColor: '#0F52BA',
  },
  typePillText: {
    fontSize: 11,
  },
  typePillTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  formCol: {
    gap: Spacing.half,
  },
  quoteInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  condPill: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#60646C',
    borderRadius: 8,
  },
  condPillSelected: {
    backgroundColor: '#0F52BA',
    borderColor: '#0F52BA',
  },
  condPillText: {
    fontSize: 11,
  },
  condPillTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sendQuoteButton: {
    backgroundColor: '#059669',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  sendQuoteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  existingQuotesWrapper: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: Spacing.two,
  },
  existingQuotesTitle: {
    fontSize: 14,
  },
  quoteItemCard: {
    padding: Spacing.two,
    borderRadius: 10,
    gap: Spacing.one,
  },
  quoteItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quoteProviderType: {
    fontSize: 12,
  },
  quoteCost: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
  },
  partConditionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partConditionText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
  },
  quoteNotes: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
