import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
import { DealerDashboard } from '@/components/dealer/DealerDashboard';
import { MechanicDashboard } from '@/components/mechanic/MechanicDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { HomeServiceSections } from '@/components/home/HomeServiceSections';
import { useMyRequests } from '@/hooks/useRequests';
import { useBookings } from '@/hooks/useBookings';
import { useAddresses, useReplaceAddresses, useVehicles } from '@/hooks/useProfile';
import { useParts } from '@/hooks/useParts';
import { useNotifications } from '@/hooks/useNotifications';
import { ScreenContainer, AdSlot } from '@/components/ui';
import { LocationPicker, type PickedLocation } from '@/maps';

/**
 * Home — rebuilt around the product: a service-bay hero, a job-sheet service
 * index, and live status rows. Quiet chrome, one accent, mono figures.
 */

import { styles } from '@/components/home/customer/styles';
import { TopBar } from '@/components/home/customer/TopBar';
import { Hero } from '@/components/home/customer/Hero';
import { LocationRow } from '@/components/home/customer/LocationRow';
import { WorkshopBand } from '@/components/home/customer/WorkshopBand';
import { VehicleSection } from '@/components/home/customer/VehicleSection';
import { LiveStatusSection } from '@/components/home/customer/LiveStatusSection';
import { PartsRail } from '@/components/home/customer/PartsRail';
import { PackagesSection } from '@/components/home/customer/PackagesSection';
import { EditorialBand } from '@/components/home/customer/EditorialBand';
import { HistoryRail } from '@/components/home/customer/HistoryRail';
import { AssuranceSection } from '@/components/home/customer/AssuranceSection';
import { Footer } from '@/components/home/customer/Footer';

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
  const historyBookings = (bookingsQuery.data?.items ?? [])
    .filter((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED')
    .slice(0, 6);
  const loading = requestsQuery.isLoading || bookingsQuery.isLoading;

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
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <TopBar router={router} user={user} unreadCount={unreadCount} />

        <Hero router={router} />

        <View style={styles.body}>
          <LocationRow router={router} address={address} setLocationOpen={setLocationOpen} />

          <HomeServiceSections />

          <WorkshopBand />

          <VehicleSection router={router} vehicle={vehicle} vehicles={vehicles} />

          <LiveStatusSection router={router} requests={requests} nextBooking={nextBooking} loading={loading} />

          {/* Dedicated ad space — one per screen, labelled, never in the hero */}
          <AdSlot placement="home-sponsored" />

          <PartsRail router={router} parts={parts} />

          <PackagesSection router={router} />

          <EditorialBand />

          <HistoryRail router={router} historyBookings={historyBookings} />

          <AssuranceSection />

          <Footer router={router} />

        </View>
      </ScrollView>

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
