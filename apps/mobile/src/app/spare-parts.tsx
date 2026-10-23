import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiClient } from '@/services/api-client';
import { useAuth } from '@/services/auth-store';

interface SparePartProvider {
  id: string;
  businessName: string;
  badge: 'PLATINUM' | 'GOLD' | 'SILVER' | null;
}

interface SparePartItem {
  id: string;
  kind?: 'PART' | 'PACKAGE';
  name: string;
  partNumber: string;
  compatibleMakes: string[];
  compatibleModels: string[];
  condition: 'OEM' | 'AFTERMARKET' | 'USED';
  price: number;
  stockQuantity: number;
  imageUrl?: string | null;
  isActive: boolean;
  provider: SparePartProvider;
}

interface SparePartsResponse {
  items: SparePartItem[];
  nextCursor: string | null;
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

export default function SparePartsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState<'OEM' | 'AFTERMARKET' | 'USED' | ''>('');
  const [listingKind, setListingKind] = useState<'PART' | 'PACKAGE'>('PART');
  const [items, setItems] = useState<SparePartItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);
  const hasFilters = search.trim().length > 0 || condition !== '';

  const fetchParts = useCallback(
    async (opts: { refresh?: boolean; loadMore?: boolean } = {}) => {
      if (isLoading) return;

      if (opts.refresh) {
        setItems([]);
        setHasMore(true);
      } else if (opts.loadMore) {
        if (!hasMore || !nextCursor) return;
      }

      setIsLoading(true);

      try {
        const response = await apiClient.get<SparePartsResponse>('/spare-parts', {
          params: {
            search: search.trim() || undefined,
            condition: condition || undefined,
            kind: listingKind || undefined,
            cursor: opts.loadMore ? (nextCursor ?? undefined) : undefined,
            limit: 20,
          },
        });

        if (opts.refresh) {
          setItems(response.items);
        } else if (opts.loadMore) {
          setItems((prev) => [...prev, ...response.items]);
        } else {
          setItems(response.items);
        }

        setNextCursor(response.nextCursor);
        setHasMore(Boolean(response.nextCursor));
      } catch (err: any) {
        if (!opts.refresh && !opts.loadMore) {
          Alert.alert(
            'Unable to load parts',
            err?.message || 'Check your connection and try again.',
          );
        }
      } finally {
        setIsLoading(false);
        initialLoad.current = false;
      }
    },
    [search, condition, listingKind, isLoading, hasMore, nextCursor],
  );

  // Initial load + reload when filters change
  useEffect(() => {
    if (initialLoad.current) {
      void fetchParts({ refresh: false });
      initialLoad.current = false;
      return;
    }
    void fetchParts({ refresh: true });
  }, [search, condition, listingKind, fetchParts]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void fetchParts({ refresh: true });
    }, 300);
  };

  const handleLoadMore = () => {
    if (hasMore && nextCursor && !isLoading) {
      void fetchParts({ loadMore: true });
    }
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
          style={[
            styles.badgeText,
            { color: style.text, backgroundColor: style.bg },
          ]}>
          {BADGE_LABEL[badge]}
        </ThemedText>
      </Pressable>
    );
  };

  const renderItem = ({ item }: { item: SparePartItem }) => (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.topRow}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            accessibilityLabel={`Image of ${item.name}`}
          />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.thumbnailPlaceholder} themeColor="textSecondary">
              📦
            </ThemedText>
          </View>
        )}

        <View style={styles.itemInfo}>
          <ThemedText type="smallBold" style={styles.partTitle}>
            {item.name}
          </ThemedText>
          <ThemedText style={styles.partNumber} themeColor="textSecondary">
            #{item.partNumber}
          </ThemedText>
          <View style={styles.conditionRow}>
            {item.kind === 'PACKAGE' ? (
              <View style={[styles.conditionChip, { borderColor: theme.primary, backgroundColor: theme.primarySurface }]}>
                <ThemedText style={[styles.conditionChipText, { color: theme.primary }]}>
                  Service Package
                </ThemedText>
              </View>
            ) : (
              CONDITIONS.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityState={{ selected: item.condition === c.key }}
                style={[
                  styles.conditionChip,
                  {
                    borderColor:
                      item.condition === c.key ? theme.primary : theme.border,
                    backgroundColor:
                      item.condition === c.key ? theme.primarySurface : 'transparent',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.conditionChipText,
                    item.condition === c.key && { color: theme.primary },
                  ]}>
                  {c.label}
                </ThemedText>
              </Pressable>
              ))
            )}
          </View>
          <View style={styles.priceRow}>
            <ThemedText style={[styles.price, { color: theme.primary }]}>
              ₹{item.price.toLocaleString('en-IN')}
            </ThemedText>
            {item.stockQuantity === 0 && (
              <ThemedText style={styles.outOfStock} themeColor="danger">
                Out of stock
              </ThemedText>
            )}
            {item.kind === 'PART' && item.stockQuantity > 0 && item.stockQuantity <= 3 && (
              <ThemedText style={styles.outOfStock} themeColor="warning">
                Only {item.stockQuantity} left
              </ThemedText>
            )}
          </View>
          {item.provider.badge && renderBadge(item.provider.badge)}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <ThemedText style={styles.providerName} themeColor="textSecondary">
          {item.provider.businessName}
        </ThemedText>
        <ThemedText style={styles.compatible} themeColor="textSecondary">
          Fits: {(item.compatibleMakes || []).join(', ') ||
            (item.compatibleModels || []).join(', ') || '—'}
        </ThemedText>
        <Pressable
          onPress={() =>
            router.push(`/spare-parts/${item.id}`)
          }
          accessibilityRole="button"
          accessibilityLabel={`View details for ${item.name}`}
          disabled={item.stockQuantity === 0}
          style={styles.viewDetailsBtn}>
          <ThemedText style={styles.viewDetailsText}>
            {item.stockQuantity === 0 ? 'Out of Stock' : 'View Details'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const keyExtractor = (item: SparePartItem) => item.id;
  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.three, paddingBottom: Spacing.six },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentWrapper, { maxWidth: MaxContentWidth }]}>
          {/* Kind switch: Parts | Packages */}
          <View style={styles.kindSwitch}>
            {([['PART', 'Parts'], ['PACKAGE', 'Packages']] as const).map(
              ([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: listingKind === key }}
                  onPress={() => {
                    setListingKind(key);
                    initialLoad.current = true;
                  }}
                  style={[styles.kindTab, listingKind === key && styles.kindTabActive]}>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.kindTabText,
                      listingKind === key && { color: theme.inverseText },
                    ]}>
                    {label}
                  </ThemedText>
                </Pressable>
              ),
            )}
          </View>
          {(
            auth.user?.role === 'PROVIDER' ||
            auth.user?.role === 'BOTH' ||
            auth.user?.role === 'ADMIN'
          ) && (
            <View style={styles.entryRow}>
              <Pressable
                onPress={() => router.push('/spare-parts/create')}
                accessibilityRole="button"
                accessibilityLabel="List a new spare part"
                style={styles.createBtn}>
                <ThemedText style={styles.createBtnText}>+ List a Spare Part</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => router.push('/history')}
                accessibilityRole="button"
                accessibilityLabel="View my service history"
                style={styles.createBtn}>
                <ThemedText style={styles.createBtnText}>My History</ThemedText>
              </Pressable>
            </View>
          )}
          {(
            auth.user?.role === 'PROVIDER' ||
            auth.user?.role === 'BOTH' ||
            auth.user?.role === 'ADMIN'
          ) && (
            <View style={[styles.entryRow, { marginTop: Spacing.one * -1 }]}>
              <Pressable
                onPress={() => router.push('/orders/dealer')}
                accessibilityRole="button"
                accessibilityLabel="View orders received"
                style={styles.createBtn}>
                <ThemedText style={styles.createBtnText}>Orders Received</ThemedText>
              </Pressable>
            </View>
          )}
          {/* Search */}
          <View style={styles.searchBar}>
            <TextInput
              accessibilityLabel="Search spare parts by name or part number"
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="Search parts (e.g. brake pad, headlight)"
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={handleSearchChange}
              clearButtonMode="while-editing"
              returnKeyType="search"
              autoCapitalize="words"
            />
            {search.trim().length > 0 && (
              <Pressable
                onPress={() => {
                  setSearch('');
                  void fetchParts({ refresh: true });
                }}
                accessibilityLabel="Clear search"
                style={styles.clearBtn}>
                <ThemedText style={styles.clearText}>✕</ThemedText>
              </Pressable>
            )}
          </View>

          {/* Condition filter */}
          <ThemedText style={styles.sectionTitle} themeColor="textSecondary">
            Filter by condition
          </ThemedText>
          <View style={styles.chipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !condition }}
              onPress={() => setCondition('')}
              style={[
                styles.conditionChip,
                !condition && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primarySurface,
                },
              ]}>
              <ThemedText
                style={[
                  styles.conditionChipText,
                  !condition && { color: theme.primary, fontWeight: '700' },
                ]}>
                All
              </ThemedText>
            </Pressable>
            {CONDITIONS.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityState={{ selected: condition === c.key }}
                onPress={() => setCondition(c.key)}
                style={[
                  styles.conditionChip,
                  {
                    borderColor: condition === c.key ? theme.primary : theme.border,
                    backgroundColor:
                      condition === c.key ? theme.primarySurface : 'transparent',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.conditionChipText,
                    condition === c.key && { color: theme.primary },
                  ]}>
                  {c.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Parts list */}
          {items.length === 0 && !isLoading && (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.emptyTitle} themeColor="textSecondary">
                {hasFilters
                  ? 'No spare parts found'
                  : listingKind === 'PACKAGE'
                    ? 'No service packages yet'
                    : 'No spare parts listed yet'}
              </ThemedText>
              <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
                {hasFilters
                  ? 'Try adjusting your search or condition filter.'
                  : listingKind === 'PACKAGE'
                    ? 'Verified workshops are preparing packages. Check back soon.'
                    : 'Verified dealers are stocking up. Pull to refresh in a moment.'}
              </ThemedText>
              {!hasFilters && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh spare parts"
                  onPress={() => fetchParts({ refresh: true })}
                  style={[styles.viewDetailsBtn, { marginTop: Spacing.two }]}>
                  <ThemedText style={styles.viewDetailsText}>Refresh</ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {items.length > 0 && (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={null}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          )}

          {isLoading && items.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}

          {hasMore && nextCursor && (
            <Pressable
              onPress={handleLoadMore}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Load more spare parts"
              style={styles.loadMoreBtn}>
              <ThemedText style={styles.loadMoreText}>
                {isLoading ? 'Loading...' : 'Load More'}
              </ThemedText>
            </Pressable>
          )}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.large,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.three,
    width: '100%',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    paddingVertical: Spacing.one,
  },
  clearBtn: {
    marginLeft: Spacing.one,
  },
  clearText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.three,
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
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.large,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    width: '100%',
    ...Elevation.low,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.medium,
    backgroundColor: theme.backgroundElement,
  },
  thumbnailPlaceholder: {
    fontSize: 32,
    textAlign: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  partTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  partNumber: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: Spacing.one,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
  },
  outOfStock: {
    fontSize: 12,
    fontWeight: '700',
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
    marginVertical: Spacing.two,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerName: {
    fontSize: 12,
    fontWeight: '600',
  },
  compatible: {
    fontSize: 11,
    color: theme.textSecondary,
    maxWidth: '60%',
  },
  viewDetailsBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.primarySurface,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.primary,
  },
  listContent: {
    paddingBottom: Spacing.three,
  },
  itemSeparator: {
    height: 8,
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
  },
  loadMoreBtn: {
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.large,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.two,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  createBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.primarySurface,
  },
  entryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primary,
  },
  kindSwitch: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  kindTab: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: theme.border,
  },
  kindTabActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  kindTabText: {
    color: theme.text,
  },
});
