import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiClient } from '@/services/api-client';

interface SparePartDetailProvider {
  id: string;
  businessName: string;
  badge: 'PLATINUM' | 'GOLD' | 'SILVER' | null;
}

interface SparePartDetail {
  id: string;
  name: string;
  partNumber: string;
  compatibleMakes: string[];
  compatibleModels: string[];
  condition: 'OEM' | 'AFTERMARKET' | 'USED';
  price: number;
  stockQuantity: number;
  imageUrl?: string | null;
  isActive: boolean;
  provider: SparePartDetailProvider;
  createdAt: string;
}

const CONDITIONS: { key: 'OEM' | 'AFTERMARKET' | 'USED'; label: string }[] = [
  { key: 'OEM', label: 'OEM' },
  { key: 'AFTERMARKET', label: 'Aftermarket' },
  { key: 'USED', label: 'Used' },
];

const BADGE_LABEL: Record<string, string> = {
  PLATINUM: 'Platinum',
  GOLD: 'Gold',
  SILVER: 'Silver',
};

export default function SparePartsDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [part, setPart] = useState<SparePartDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPart = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<SparePartDetail>(
        `/spare-parts/${id as string}`,
      );
      setPart(response);
    } catch (err: any) {
      setError(
        err?.message || 'Unable to load spare part details. Try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPart();
  }, [fetchPart]);

  const handleRetry = () => {
    setError(null);
    void fetchPart();
  };

  const renderBadge = (badge: string | null) => {
    if (!badge) return null;

    const colors: Record<string, { bg: string; text: string }> = {
      PLATINUM: { bg: theme.primary, text: theme.inverseText },
      GOLD: { bg: theme.warningSurface, text: theme.warning },
      SILVER: { bg: theme.info, text: theme.inverseText },
    };

    const style = colors[badge] || colors.SILVER;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${BADGE_LABEL[badge]} provider`}
        style={styles.badgeChip}>
        <ThemedText
          type="smallBold"
          style={[styles.badgeText, { color: style.text, backgroundColor: style.bg }]}>
          {BADGE_LABEL[badge]}
        </ThemedText>
      </Pressable>
    );
  };

  const styles = makeStyles(theme);

  if (isLoading) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.three },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (error || !part) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.three },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.emptyCard}>
            <ThemedText style={styles.emptyTitle} themeColor="textSecondary">
              {error || 'Spare part not found'}
            </ThemedText>
            <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
              {error
                ? 'We could not load this spare part right now.'
                : 'This spare part is no longer available.'}
            </ThemedText>
            <Pressable
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading spare part"
              style={styles.retryBtn}>
              <ThemedText style={styles.retryText}>Try Again</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrapper}>

          {/* Header: back + title */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}>
              <ThemedText style={styles.backText}>‹</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              Spare Part Details
            </ThemedText>
          </View>

          {/* Image */}
          {part.imageUrl ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: part.imageUrl }}
                style={styles.imageContainer}
                contentFit="cover"
                accessibilityLabel={`Image of ${part.name}`}
              />
              {part.stockQuantity === 0 && (
                <View style={styles.outOfStockOverlay}>
                  <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.imageWrapper, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.imagePlaceholder} themeColor="textSecondary">
                📦
              </ThemedText>
              {part.stockQuantity === 0 && (
                <View style={styles.outOfStockOverlay}>
                  <ThemedText style={styles.outOfStockText}>Out of Stock</ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Name + part number */}
          <ThemedText type="smallBold" style={styles.partTitle}>
            {part.name}
          </ThemedText>
          <ThemedText style={styles.partNumber} themeColor="textSecondary">
            Part #{part.partNumber}
          </ThemedText>

          {/* Condition chips */}
          <ThemedText style={styles.sectionTitle} themeColor="textSecondary">
            Condition
          </ThemedText>
          <View style={styles.chipRow}>
            {CONDITIONS.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityState={{ selected: part.condition === c.key }}
                style={[
                  styles.conditionChip,
                  {
                    borderColor:
                      part.condition === c.key ? theme.primary : theme.border,
                    backgroundColor:
                      part.condition === c.key ? theme.primarySurface : 'transparent',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.conditionChipText,
                    part.condition === c.key && { color: theme.primary },
                  ]}>
                  {c.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Price + stock */}
          <View style={styles.priceRow}>
            <ThemedText style={[styles.price, { color: theme.primary }]}>
              ₹{part.price.toLocaleString('en-IN')}
            </ThemedText>
            {part.stockQuantity === 0 ? (
              <ThemedText style={styles.outOfStock} themeColor="danger">
                Out of stock
              </ThemedText>
            ) : (
              <ThemedText style={styles.inStock} themeColor="success">
                In stock ({part.stockQuantity})
              </ThemedText>
            )}
          </View>

          {/* Compatible makes/models */}
          <ThemedText style={styles.sectionTitle} themeColor="textSecondary">
            Compatible With
          </ThemedText>
          <View style={styles.compatibleBox}>
            <ThemedText style={styles.compatibleLabel} themeColor="textSecondary">
              Makes:
            </ThemedText>
            <ThemedText style={styles.compatibleValue} themeColor="textSecondary">
              {(part.compatibleMakes || []).join(', ') || 'Not specified'}
            </ThemedText>
            <ThemedText style={styles.compatibleLabel} themeColor="textSecondary">
              Models:
            </ThemedText>
            <ThemedText style={styles.compatibleValue} themeColor="textSecondary">
              {(part.compatibleModels || []).join(', ') || 'Not specified'}
            </ThemedText>
          </View>

          {/* Provider */}
          <View style={styles.providerRow}>
            <View style={styles.providerInfo}>
              <ThemedText type="smallBold" style={styles.providerTitle}>
                Seller
              </ThemedText>
              <ThemedText style={styles.providerName} themeColor="textSecondary">
                {part.provider.businessName}
              </ThemedText>
              {part.provider.badge && renderBadge(part.provider.badge)}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Actions */}
          <View style={styles.actionRow}>
            {part.stockQuantity > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Buy this spare part"
                style={[styles.buyBtn, { backgroundColor: theme.primary }]}
                onPress={() =>
                  router.push({
                    pathname: '/spare-parts/checkout',
                    params: { id: part.id },
                  })
                }>
                <ThemedText
                  style={[styles.buyText, { color: theme.inverseText }]}>
                  Buy Now
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Out of stock"
                disabled
                style={styles.disabledBuyBtn}>
                <ThemedText style={styles.disabledBuyText}>Out of Stock</ThemedText>
              </Pressable>
            )}
          </View>

          <View style={styles.spacer} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (
  theme: NonNullable<ReturnType<typeof useTheme>>,
) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.two,
  },
  backBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  backText: {
    fontSize: 18,
    color: theme.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: Spacing.two,
    color: theme.text,
  },
  imageWrapper: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.large,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Elevation.low,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.large,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    ...Elevation.low,
  },
  imagePlaceholder: {
    fontSize: 48,
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: BorderRadius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  partTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 2,
  },
  partNumber: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.one,
    marginTop: Spacing.three,
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.two,
    width: '100%',
  },
  conditionChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.three,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
  },
  outOfStock: {
    fontSize: 13,
    fontWeight: '700',
  },
  inStock: {
    fontSize: 13,
    fontWeight: '700',
  },
  compatibleBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
    padding: Spacing.two,
    width: '100%',
    marginBottom: Spacing.three,
  },
  compatibleLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  compatibleValue: {
    fontSize: 13,
    marginBottom: Spacing.one,
  },
  providerRow: {
    width: '100%',
    marginBottom: Spacing.three,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  providerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
    marginRight: Spacing.one,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  badgeChip: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.one,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: Spacing.three,
    width: '100%',
  },
  actionRow: {
    width: '100%',
  },
  disabledBuyBtn: {
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.large,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabledBuyText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  buyBtn: {
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.large,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buyText: {
    fontSize: 15,
    fontWeight: '700',
  },
  spacer: {
    height: Spacing.four,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  retryBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.primarySurface,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primary,
  },
});
