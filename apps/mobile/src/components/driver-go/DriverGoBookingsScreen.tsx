import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BackButton,
  Button,
  EmptyState,
  ScreenContainer,
  SectionHead,
  Skeleton,
} from '@/components/ui';
import { useMyDriverBookings } from '@/hooks/useDriverGoCustomer';
import { CustomerBookingCard } from './CustomerBookingCard';
import { palette, spacing, typography } from '@/theme';

const ACTIVE = [
  'REQUESTED',
  'CONFIRMED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
];
const PAST = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'];

export function DriverGoBookingsScreen() {
  const router = useRouter();
  const query = useMyDriverBookings();
  const refetch = query.refetch;
  const bookings = query.data?.items ?? [];

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const active = bookings.filter((booking) => ACTIVE.includes(booking.status));
  const past = bookings.filter((booking) => PAST.includes(booking.status));

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.eyebrow}>DRIVER GO</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>My driver bookings</Text>
        <Text style={styles.subtitle}>
          Track requests, start codes and completed trips.
        </Text>

        {query.isLoading ? (
          <View style={{ marginTop: spacing.lg }}>
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={140}
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </View>
        ) : query.isError ? (
          <EmptyState
            title="Bookings unavailable"
            message="Check your connection and try again."
            action={
              <Button title="Retry" variant="secondary" onPress={() => void refetch()} />
            }
          />
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No driver bookings yet"
            message="Book a verified driver for your own car, by the hour or day."
            action={
              <Button
                title="Book a driver"
                onPress={() => router.push('/driver-go/book')}
              />
            }
          />
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <SectionHead index="01" title="Active" />
                {active.map((booking) => (
                  <CustomerBookingCard
                    key={booking.id}
                    booking={booking}
                    onPress={() =>
                      router.push(`/driver-go/bookings/${booking.id}`)
                    }
                  />
                ))}
              </>
            ) : null}

            {past.length > 0 ? (
              <>
                <SectionHead
                  index={active.length > 0 ? '02' : '01'}
                  title="History"
                />
                {past.map((booking) => (
                  <CustomerBookingCard
                    key={booking.id}
                    booking={booking}
                    onPress={() =>
                      router.push(`/driver-go/bookings/${booking.id}`)
                    }
                  />
                ))}
              </>
            ) : null}
          </>
        )}

        <Button
          title="Book another driver"
          variant="secondary"
          onPress={() => router.push('/driver-go/book')}
          style={styles.cta}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
  },
  spacer: { width: 44 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.title, color: palette.textPrimary },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  cta: { marginTop: spacing.lg },
});
