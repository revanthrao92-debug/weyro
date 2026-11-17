import { ScrollView, Text, View } from 'react-native';
import { PressableScale, SectionHead as Head } from '@/components/ui';
import { labelize, formatDate } from '@/utils/format';

import type { useRouter } from 'expo-router';
import type { Booking } from '@/hooks/useBookings';
import { styles } from './styles';

export function HistoryRail({ router, historyBookings }: {
  router: ReturnType<typeof useRouter>;
  historyBookings: Booking[];
}) {
  return (
    <>
      {/* History — second horizontal rail */}
      <Head
        index="06"
        title="History"
        action="Bookings"
        onAction={() => router.push('/bookings')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.rail}
      >
        {historyBookings.length === 0 ? (
          <View style={styles.railCard}>
            <Text style={styles.railKicker}>No history</Text>
            <Text style={styles.railTitle}>Completed services appear here</Text>
          </View>
        ) : (
          historyBookings.map((booking) => (
            <PressableScale
              key={booking.id}
              onPress={() => router.push(`/booking/${booking.id}`)}
              accessibilityRole="button"
              accessibilityLabel="Past booking"
              scaleTo={0.98}
              style={styles.railCard}
            >
              <Text style={styles.railKicker}>{labelize(booking.status)}</Text>
              <Text style={styles.railTitle} numberOfLines={2}>
                {booking.provider?.businessName ?? 'Booking'}
              </Text>
              <Text style={styles.railMeta}>
                {formatDate(booking.scheduledAt ?? booking.createdAt)}
              </Text>
            </PressableScale>
          ))
        )}
      </ScrollView>
    </>
  );
}
