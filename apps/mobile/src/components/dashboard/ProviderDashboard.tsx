import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Package,
  MessageSquareQuote,
  Navigation,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useBroadcastFeed, useMyQuotations } from '@/hooks/useRequests';
import { useDealerOrders, useMyParts } from '@/hooks/useParts';
import { useBookings } from '@/hooks/useBookings';
import {
  ScreenContainer,
  AppHeader,
  EmptyState,
  SectionCard,
  Skeleton,
  StatusPill,
  AdBanner,
  StatusDot,
} from '@/components/ui';
import { photoForCategory, photo } from '@/lib/photos';
import { labelize, formatDate, humanizeKey } from '@/utils/format';
import { palette, spacing, radii, typography } from '@/theme';

/**
 * Provider Dashboard — Checkpoint 3 ("Dealer / Mechanic interfaces").
 * Rigid + photographic design language shared with the customer app:
 * dark hero (role chip), KPI cards, photo-backed feed cards, ad slots.
 *
 * Hooks are all existing server endpoints; no API changes.
 */

const OPEN_QUOTE_STATES = new Set(['PENDING', 'ACCEPTED']);

export default function ProviderDashboard() {
  const router = useRouter();
  const { user, providerProfile } = useAuth();

  const roleLabel =
    (providerProfile as { providerType?: string } | null)?.providerType ===
    'PARTS_DEALER'
      ? 'Dealer'
      : (providerProfile as { providerType?: string } | null)?.providerType
        ? labelize(
            (providerProfile as { providerType?: string }).providerType ?? '',
          )
        : 'Provider';
  const isDealer =
    (providerProfile as { providerType?: string } | null)?.providerType ===
    'PARTS_DEALER';

  const businessName =
    (providerProfile as { businessName?: string } | null)?.businessName ||
    user?.email?.split('@')[0] ||
    'Partner';

  const feedQuery = useBroadcastFeed();
  const quotesQuery = useMyQuotations();
  const ordersQuery = useDealerOrders();
  const listingsQuery = useMyParts();
  const bookingsQuery = useBookings();

  const feed = (feedQuery.data?.items ?? []).slice(0, 4);
  const quotes = quotesQuery.data?.items ?? [];
  const openQuotes = quotes.filter((q) => OPEN_QUOTE_STATES.has(q.status)).length;
  const orders = (ordersQuery.data?.items ?? []).filter((o) =>
    ['PENDING', 'PAID'].includes(o.status),
  ).length;
  const listings = listingsQuery.data?.items ?? [];
  const activeJobs = (bookingsQuery.data?.items ?? []).filter((b) =>
    ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(b.status),
  ).length;

  const loading =
    feedQuery.isLoading || quotesQuery.isLoading || bookingsQuery.isLoading;

  const kpis = isDealer
    ? [
        { label: 'Open quotes', value: openQuotes, Icon: MessageSquareQuote },
        { label: 'New orders', value: orders, Icon: Package },
        { label: 'Listings', value: listings.length, Icon: Navigation },
      ]
    : [
        { label: 'Open quotes', value: openQuotes, Icon: MessageSquareQuote },
        { label: 'Jobs nearby', value: feed.length, Icon: Navigation },
        { label: 'Booked', value: activeJobs, Icon: Package },
      ];

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <View style={styles.hero}>
        <AppHeader
          logo={require('../../../assets/images/weyro-logo.png')}
          subtitle="Work at your pace."
        />
        <View style={styles.heroInner}>
          <View style={styles.roleRow}>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{roleLabel}</Text>
            </View>
          </View>
          <Text style={styles.greeting}>Work today,</Text>
          <Text style={styles.greetingName} maxFontSizeMultiplier={1.6}>
            {businessName}
          </Text>
          <Text style={styles.heroTagline}>Your vehicle, our priority.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI cards — photo-backed, rigid */}
        <View style={styles.kpiRow}>
          {kpis.map(({ label, value, Icon }) => (
            <View style={styles.kpiCard} key={label}>
              <View style={styles.kpiIcon}>
                <Icon size={18} color={palette.teal} strokeWidth={1.75} />
              </View>
              {loading ? (
                <Skeleton width={36} height={22} />
              ) : (
                <Text style={styles.kpiValue}>{value}</Text>
              )}
              <Text style={styles.kpiLabel} maxFontSizeMultiplier={2}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Incoming requests — dark band so the light sheet reads as one flow */}
        <View style={styles.darkBand}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusDot />
            <Text style={styles.sectionTitleDark}>Requests near you</Text>
          </View>
        </View>
        {loading ? (
          <Skeleton width="100%" height={96} />
        ) : feed.length === 0 ? (
          <EmptyState
            title="No open requests nearby"
            message="New customer requests will appear here as they arrive."
          />
        ) : (
          <View style={styles.feed}>
            {feed.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/requests/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Request ${item.title}`}
                className="active:opacity-80"
                style={styles.feedCard}
              >
                <Image
                  source={{ uri: photo(photoForCategory(item.category)) }}
                  style={styles.feedPhoto}
                  contentFit="cover"
                />
                <View style={styles.feedShade} />
                <View style={styles.feedInner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feedTitle} numberOfLines={1} maxFontSizeMultiplier={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.feedMeta} numberOfLines={1}>
                      {humanizeKey(item.category ?? '')} ·{' '}
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  <StatusPill
                    label={labelize(item.status)}
                    tone={
                      item.status === 'OPEN' ? 'info' : 'neutral'
                    }
                  />
                  <ChevronRight size={16} color={palette.onHeaderMuted} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        </View>

        {/* Sponsored slot */}
        <View style={styles.adSlot}>
          <AdBanner placement="home-section" />
        </View>

        {/* Recent quotes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My quotes</Text>
          <Pressable
            onPress={() => router.push('/my-quotes')}
            accessibilityRole="link"
            className="active:opacity-60"
          >
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        <SectionCard>
          {loading ? (
            <Skeleton width="100%" height={44} />
          ) : quotes.length === 0 ? (
            <Text style={styles.emptyLine}>
              No quotes yet — open a request near you and quote it.
            </Text>
          ) : (
            quotes.slice(0, 3).map((q) => (
              <Pressable
                key={q.id}
                onPress={() => router.push('/my-quotes')}
                accessibilityRole="button"
                style={styles.listRow}
                accessibilityLabel={`Quote ${q.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>
                    {`₹${Number(q.totalCost).toLocaleString()}`}
                  </Text>
                  <Text style={styles.listRowMeta} numberOfLines={1}>
                    {q.createdAt ? formatDate(q.createdAt) : '—'}
                  </Text>
                </View>
                <StatusPill label={labelize(q.status)} tone="neutral" />
              </Pressable>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: palette.headerAlt,
  },
  heroInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  roleRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  roleChip: {
    backgroundColor: palette.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roleChipText: {
    ...typography.label,
    color: palette.onAccent,
  },
  greeting: {
    ...typography.body,
    color: palette.onHeader,
  },
  greetingName: {
    ...typography.display,
    color: palette.onHeader,
    fontWeight: '600',
    marginTop: 2,
  },
  heroTagline: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: spacing.xs,
  },
  darkBand: {
    backgroundColor: palette.headerAlt,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitleDark: {
    ...typography.bodyMedium,
    color: palette.onHeader,
  },
  body: {
    backgroundColor: palette.canvas,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    minHeight: 400,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: palette.tealSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiValue: {
    ...typography.display,
    color: palette.textPrimary,
    lineHeight: 30,
  },
  kpiLabel: {
    ...typography.label,
    color: palette.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  link: {
    ...typography.captionMedium,
    color: palette.teal,
  },
  feed: { gap: spacing.sm },
  feedCard: {
    height: 84,
    borderRadius: radii.md,
    backgroundColor: '#0C2330',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  feedPhoto: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  feedShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 21, 30, 0.72)',
  },
  feedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  feedTitle: {
    ...typography.heading,
    color: palette.onHeader,
  },
  feedMeta: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: 2,
  },
  adSlot: { marginTop: spacing.lg, marginBottom: spacing.xs },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  listRowTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  listRowMeta: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  emptyLine: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
