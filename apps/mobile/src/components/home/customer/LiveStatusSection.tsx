import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { StatusPill, PressableScale, SectionHead as Head } from '@/components/ui';
import { palette } from '@/theme';
import { labelize, formatDate } from '@/utils/format';

import type { useRouter } from 'expo-router';
import type { ServiceRequest } from '@/hooks/useRequests';
import type { Booking } from '@/hooks/useBookings';
import { styles } from './styles';
import { requestTone, bookingTone } from './shared';

export function LiveStatusSection({ router, requests, nextBooking, loading }: {
  router: ReturnType<typeof useRouter>;
  requests: ServiceRequest[];
  nextBooking: Booking | undefined;
  loading: boolean;
}) {
  return (
    <>
      {/* Live status */}
      <Head
        index="03"
        title="Status"
        action="All requests"
        onAction={() => router.push('/requests/my')}
      />
      <View style={styles.statusList}>
        {loading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : requests.length === 0 && !nextBooking ? (
          <PressableScale
            onPress={() => router.push('/requests/create')}
            accessibilityRole="button"
            accessibilityLabel="Post a request"
            scaleTo={0.99}
            style={styles.indexRow}
          >
            <View style={styles.indexText}>
              <Text style={styles.indexLabel}>Post a request</Text>
              <Text style={styles.indexDetail}>Get quotes from verified garages</Text>
            </View>
            <ChevronRight size={15} color={palette.textMuted} strokeWidth={1.8} />
          </PressableScale>
        ) : (
          <>
            {requests.slice(0, 2).map((request, i) => (
              <PressableScale
                key={request.id}
                onPress={() => router.push(`/requests/${request.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Request ${request.title}`}
                scaleTo={0.99}
                style={[styles.statusRow, i > 0 && styles.rowDivider]}
              >
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle} numberOfLines={1}>
                    {request.title}
                  </Text>
                  <Text style={styles.statusMeta}>
                    {labelize(request.category)} · {request.quotationsCount ?? 0} quotes
                  </Text>
                </View>
                <StatusPill
                  label={labelize(request.status)}
                  tone={requestTone(request.status)}
                />
              </PressableScale>
            ))}
            {nextBooking ? (
              <PressableScale
                onPress={() => router.push(`/booking/${nextBooking.id}`)}
                accessibilityRole="button"
                accessibilityLabel="Next booking"
                scaleTo={0.99}
                style={[styles.statusRow, requests.length > 0 && styles.rowDivider]}
              >
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle} numberOfLines={1}>
                    {nextBooking.provider?.businessName ?? 'Booking'}
                  </Text>
                  <Text style={styles.statusMeta}>
                    {[formatDate(nextBooking.scheduledAt), labelize(nextBooking.status)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <StatusPill
                  label={labelize(nextBooking.status)}
                  tone={bookingTone(nextBooking.status)}
                />
              </PressableScale>
            ) : null}
          </>
        )}
      </View>
    </>
  );
}
