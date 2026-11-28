import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { StatusPill, PressableScale, SectionHead as Head } from '@/components/ui';
import { palette, spacing, statusColors } from '@/theme';
import { bookingStatusTone, labelize } from '@/utils/format';
import type { useRouter } from 'expo-router';
import type { ServiceRequest } from '@/hooks/useRequests';
import type { Booking } from '@/hooks/useBookings';
import { styles } from './styles';
import { requestTone } from './shared';

const STAGES = ['CONFIRMED', 'PROVIDER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];

/**
 * "Your job": the one thing in progress, right under the hero. An active
 * booking wins (with its progress); otherwise the newest open request; nothing
 * when there's no activity (the hero already offers "Post a request").
 */
export function LiveStatusSection({ router, requests, nextBooking }: {
  router: ReturnType<typeof useRouter>;
  requests: ServiceRequest[];
  nextBooking: Booking | undefined;
}) {
  const openRequest = requests.find((r) => ['OPEN', 'QUOTES_RECEIVED'].includes(r.status));
  if (!nextBooking && !openRequest) return null;

  return (
    <>
      <Head title="Your job" action="All requests" onAction={() => router.push('/requests/my')} />
      {nextBooking ? (
        <BookingCard router={router} booking={nextBooking} />
      ) : openRequest ? (
        <PressableScale
          onPress={() => router.push(`/requests/${openRequest.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Request ${openRequest.title}`}
          scaleTo={0.99}
          style={styles.statusRow}
        >
          <View style={styles.statusText}>
            <Text style={styles.statusTitle} numberOfLines={1}>
              {openRequest.title}
            </Text>
            <Text style={styles.statusMeta}>
              {(openRequest.quotationsCount ?? 0) > 0
                ? `${openRequest.quotationsCount} ${openRequest.quotationsCount === 1 ? 'quote' : 'quotes'} waiting`
                : 'Waiting for quotes'}
            </Text>
          </View>
          <StatusPill label={labelize(openRequest.status)} tone={requestTone(openRequest.status)} />
        </PressableScale>
      ) : null}
    </>
  );
}

function BookingCard({ router, booking }: { router: ReturnType<typeof useRouter>; booking: Booking }) {
  const dropOff = booking.quotation?.deliveryMethod === 'PICKUP';
  const stages = dropOff ? STAGES.filter((s) => s !== 'PROVIDER_EN_ROUTE') : STAGES;
  const index = stages.indexOf(booking.status);
  const tone = bookingStatusTone(booking.status);

  return (
    <PressableScale
      onPress={() => router.push(`/booking/${booking.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Your job: ${labelize(booking.status)}`}
      scaleTo={0.99}
      style={local.card}
    >
      <View style={local.top}>
        <View style={styles.statusText}>
          <Text style={styles.statusTitle} numberOfLines={1}>
            {booking.quotation?.request?.title ?? 'Your booking'}
          </Text>
          <Text style={styles.statusMeta} numberOfLines={1}>
            {booking.provider?.businessName ?? 'Garage'}
          </Text>
        </View>
        <StatusPill label={labelize(booking.status)} tone={tone} />
        <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
      </View>
      {index >= 0 ? (
        <View style={local.track}>
          <View
            style={[
              local.fill,
              { width: `${((index + 1) / stages.length) * 100}%`, backgroundColor: statusColors[tone].fg },
            ]}
          />
        </View>
      ) : null}
    </PressableScale>
  );
}

const local = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    height: 4,
    borderRadius: 2,
    marginTop: spacing.md,
    backgroundColor: palette.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2 },
});
