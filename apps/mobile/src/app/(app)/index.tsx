import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
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
import { CustomerHome } from '@/components/home/CustomerHome';
import { useNotifications } from '@/hooks/useNotifications';
import { LocationPicker, type PickedLocation } from '@/maps';

/**
 * Home — rebuilt around the product: a service-bay hero, a job-sheet service
 * index, and live status rows. Quiet chrome, one accent, mono figures.
 */


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
    <>
      <CustomerHome
        router={router}
        firstName={user?.customerProfile?.firstName}
        vehicle={vehicle}
        nextBooking={nextBooking}
        requests={requests}
        unreadCount={unreadCount}
        onRefresh={refetchAll}
        locationLabel={address?.title === 'Home' ? address.address : address?.title || address?.address}
        onLocationPress={() => setLocationOpen(true)}
      />
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
    </>
  );
}
