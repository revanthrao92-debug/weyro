import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { useBookings, type Booking } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import {
  AppHeader,
  Card,
  Chip,
  EmptyState,
  PressableScale,
  ScreenContainer,
  Skeleton,
  StatusPill,
  ErrorState,
} from '@/components/ui';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';
import { formatDate, titleize, bookingStatusTone, formatRupees } from '@/utils/format';
import { useRefreshControl } from '@/hooks/useRefreshControl';

const FILTERS = ['ACTIVE', 'TODAY', 'COMPLETED', 'CANCELLED', 'ALL'] as const;
type Filter = (typeof FILTERS)[number];


const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PROVIDER_EN_ROUTE: 'On the way',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

function statusLabel(status: string, category?: string) {
  if (status === 'IN_PROGRESS') {
    if (category === 'TOWING') return 'Towing';
    if (category === 'ROADSIDE') return 'On site';
  }
  return STATUS_LABEL[status] ?? titleize(status);
}

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function MechanicJobsScreen() {
  const router = useRouter();
  const { providerProfile } = useAuth();
  const providerType = providerProfile?.providerType ?? '';
  const isTowing = providerType === 'TOWING';
  const isRoadside = providerType === 'ROADSIDE';
  const subtitle = isTowing
    ? 'Assigned tows and deliveries'
    : isRoadside
      ? 'Assigned roadside calls'
      : 'Assigned workshop work';
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const { data, isLoading, isError, refetch } = useBookings();
  const refreshControl = useRefreshControl(refetch);
  const bookings = useMemo(() => data?.items ?? [], [data?.items]);

  const visible = useMemo(() => {
    const matches = bookings.filter((booking) => {
      switch (filter) {
        case 'ACTIVE':
          return ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(
            booking.status,
          );
        case 'TODAY':
          return (
            isToday(booking.scheduledAt) &&
            !['CANCELLED', 'COMPLETED'].includes(booking.status)
          );
        case 'COMPLETED':
          return booking.status === 'COMPLETED';
        case 'CANCELLED':
          return booking.status === 'CANCELLED';
        default:
          return true;
      }
    });
    return [...matches].sort((a, b) => {
      const aTime = new Date(a.scheduledAt ?? a.createdAt).getTime();
      const bTime = new Date(b.scheduledAt ?? b.createdAt).getTime();
      return filter === 'COMPLETED' || filter === 'CANCELLED'
        ? bTime - aTime
        : aTime - bTime;
    });
  }, [bookings, filter]);

  const active = bookings.filter((b) =>
    ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS'].includes(b.status),
  ).length;
  const today = bookings.filter(
    (b) => isToday(b.scheduledAt) && !['CANCELLED', 'COMPLETED'].includes(b.status),
  ).length;
  const completed = bookings.filter((b) => b.status === 'COMPLETED').length;

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <AppHeader title="Jobs" subtitle={subtitle} />
      <FlatList
        refreshControl={refreshControl}
        data={isLoading ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{active}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{today}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((item) => (
                <Chip
                  key={item}
                  label={
                    item === 'ACTIVE'
                      ? 'Active'
                      : item.charAt(0) + item.slice(1).toLowerCase()
                  }
                  selected={filter === item}
                  onPress={() => setFilter(item)}
                />
              ))}
            </ScrollView>
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <Card key={i} style={styles.skeletonCard}>
                    <Skeleton width="55%" height={16} />
                    <Skeleton width="35%" height={12} style={{ marginTop: spacing.sm }} />
                  </Card>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : isError ? (
            <ErrorState message="Check your connection and try again." onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              icon={<Wrench size={26} color={palette.textMuted} strokeWidth={1.7} />}
              title={filter === 'ALL' ? 'No jobs yet' : 'Nothing here'}
              message={
                filter === 'ALL'
                  ? 'Accepted quotes become jobs and appear here.'
                  : 'No jobs match this filter.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <JobRow booking={item} onPress={() => router.push(`/job/${item.id}`)} />
        )}
      />
    </ScreenContainer>
  );
}

function JobRow({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const request = booking.quotation?.request;
  const vehicle = request?.vehicle
    ? `${request.vehicle.make} ${request.vehicle.model}${
        request.vehicle.year ? ` ${request.vehicle.year}` : ''
      }`
    : 'Vehicle';
  const who = booking.customer
    ? `${booking.customer.firstName} ${booking.customer.lastName ?? ''}`.trim()
    : 'Customer';
  const route =
    request?.category === 'TOWING' && request.dropoffAddress
      ? `${request.address} → ${request.dropoffAddress}`
      : request?.address ?? 'Workshop';

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${request?.title ?? 'Job'}, ${statusLabel(booking.status, request?.category)}`}
      scaleTo={0.99}
      style={styles.row}
    >
      <View style={styles.rowTop}>
        <Text style={styles.when}>
          {booking.scheduledAt ? formatDate(booking.scheduledAt) : formatDate(booking.createdAt)}
        </Text>
        <StatusPill
          label={statusLabel(booking.status, request?.category)}
          tone={bookingStatusTone(booking.status)}
        />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {request?.title ?? 'Service job'}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {who} · {vehicle}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.address} numberOfLines={2}>
          {route}
        </Text>
        <Text style={styles.amount}>
          {formatRupees(booking.quotation?.totalCost ?? 0)}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  stat: { flex: 1, gap: 2 },
  statValue: {
    fontFamily: fontFamilyMono,
    fontSize: 18,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...typography.label, color: palette.textMuted },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  skeletonCard: { marginBottom: spacing.md },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  when: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
  },
  title: { ...typography.bodyMedium, color: palette.textPrimary },
  meta: { ...typography.caption, color: palette.textSecondary },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  address: { ...typography.label, color: palette.textMuted, flex: 1 },
  amount: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
