import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
import { DealerDashboard } from '@/components/dealer/DealerDashboard';
import { MechanicDashboard } from '@/components/mechanic/MechanicDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useAddresses, useReplaceAddresses, useVehicles } from '@/hooks/useProfile';
import { useParts } from '@/hooks/useParts';
import { useNotifications } from '@/hooks/useNotifications';
import { ScreenContainer, AdSlot, FadeSlideIn } from '@/components/ui';
import { stagger } from '@/theme';
import { LocationPicker, type PickedLocation } from '@/maps';

/**
 * Home — rebuilt around the product: a service-bay hero, a job-sheet service
 * index, and live status rows. Quiet chrome, one accent, mono figures.
 */

import { styles } from '@/components/home/customer/styles';
import { TopBar } from '@/components/home/customer/TopBar';
import { LiveStatusSection } from '@/components/home/customer/LiveStatusSection';
import { CarHero } from '@/components/home/customer/CarHero';
import { NeedTiles } from '@/components/home/customer/NeedTiles';
import { PopularRow } from '@/components/home/customer/PopularRow';
import { RecentJobs } from '@/components/home/customer/RecentJobs';
import { WorkshopBand } from '@/components/home/customer/WorkshopBand';
import { AssuranceSection } from '@/components/home/customer/AssuranceSection';

export default function HomeScreen() {
  const router = useRouter();
  const { user, role, providerProfile } = useAuth();

  const requestsQuery = useMyRequests();
  const bookingsQuery = useBookings();
  // The customers/me endpoints only allow CUSTOMER and BOTH; other roles get 403.
  const isCustomer = role === 'CUSTOMER' || role === 'BOTH';
  const vehiclesQuery = useVehicles(isCustomer);
  const addressesQuery = useAddresses(isCustomer);
  const replaceAddresses = useReplaceAddresses();
  const [locationOpen, setLocationOpen] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const partsQuery = useParts({ limit: 8 });
  const { unreadCount, refetch: refetchNotifications } = useNotifications();

  const refetchAll = useCallback(async () => {
    await Promise.all([
      requestsQuery.refetch(),
      bookingsQuery.refetch(),
      // refetch() ignores `enabled`, so gate it here too.
      isCustomer ? vehiclesQuery.refetch() : undefined,
      refetchNotifications(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer]);

  useFocusEffect(
    useCallback(() => {
      void refetchAll();
    }, [refetchAll])
  );

  const requests = requestsQuery.data?.items ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];
  const parts = (partsQuery.data?.items ?? []).slice(0, 4);
  const address = addressesQuery.data?.addresses?.[0];
  const homeLocation: PickedLocation | null = address
    ? {
        address: address.address,
        latitude: address.latitude,
        longitude: address.longitude,
        label: address.title,
      }
    : null;

  const saveHomeLocation = async (next: PickedLocation) => {
    const rest = (addressesQuery.data?.addresses ?? []).filter(
      (item) => item.title !== 'Home',
    );
    try {
      await replaceAddresses.mutateAsync([
        {
          id: 'home',
          title: 'Home',
          address: next.address,
          latitude: next.latitude,
          longitude: next.longitude,
        },
        ...rest,
      ]);
    } catch (error: any) {
      Alert.alert(
        'Location not saved',
        error?.message ?? 'Could not save this location. Try again.',
      );
    }
  };
  const vehicle = vehicles[0];
  const nextBooking = (bookingsQuery.data?.items ?? []).find(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );

  if (role === 'ADMIN') {
    return <AdminDashboard />;
  }

  if (providerProfile?.providerType === 'DRIVER') {
    return <DriverDashboard />;
  }

  if (providerProfile?.providerType === 'PARTS_DEALER') {
    return <DealerDashboard />;
  }

  if (
    ['MECHANIC', 'GARAGE', 'AUTHORIZED_CENTER', 'TOWING', 'ROADSIDE'].includes(
      providerProfile?.providerType ?? '',
    )
  ) {
    return <MechanicDashboard />;
  }

  if (role === 'PROVIDER' || role === 'BOTH') {
    return <ProviderDashboard />;
  }

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <TopBar router={router} user={user} unreadCount={unreadCount} />

        {/* 1. Your car (with the one main action) */}
        <FadeSlideIn delay={stagger(0)}>
          <CarHero
            router={router}
            vehicle={vehicle}
            scrollY={scrollY}
            locationLabel={address?.title === 'Home' ? address.address : address?.title || address?.address}
            onLocationPress={() => setLocationOpen(true)}
          />
        </FadeSlideIn>

        <View style={styles.body}>
          {/* 2. Your job: only when something is moving */}
          <FadeSlideIn delay={stagger(1)}>
            <LiveStatusSection router={router} requests={requests} nextBooking={nextBooking} />
          </FadeSlideIn>

          {/* 3. What do you need? */}
          <FadeSlideIn delay={stagger(2)}>
            <NeedTiles router={router} />
          </FadeSlideIn>

          {/* 4. The one dedicated ad space, right after your own things */}
          <View style={styles.adGap}>
            <AdSlot placement="home-sponsored" height={120} />
          </View>

          {/* 5. Things you can buy, in one row */}
          <PopularRow router={router} parts={parts} />

          {/* 6. Why Weyro is safe: the trust photo and three lines */}
          <WorkshopBand />
          <AssuranceSection />

          {/* 7. Your recent finished jobs */}
          <RecentJobs router={router} bookings={bookingsQuery.data?.items ?? []} />
        </View>
      </Animated.ScrollView>

      <LocationPicker
        visible={locationOpen}
        title="Set your location"
        hint="Used to find providers near you"
        initial={homeLocation}
        confirmLabel="Save location"
        onClose={() => setLocationOpen(false)}
        onConfirm={(next) => {
          setLocationOpen(false);
          void saveHomeLocation(next);
        }}
      />
    </ScreenContainer>
  );
}
