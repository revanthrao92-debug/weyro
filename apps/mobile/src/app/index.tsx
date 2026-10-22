import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { damageRequestStore } from '@/services/damage-request-store';
import { useAuth } from '@/services/auth-store';
import { haversineDistanceKm, estimateTowingFare } from '@weyro/api-contracts';
import { DamageVehicleSection } from '@/components/damage-post/DamageVehicleSection';
import { DamagePhotoUploader } from '@/components/damage-post/DamagePhotoUploader';
import { DamageFulfillmentSection } from '@/components/damage-post/DamageFulfillmentSection';
import {
  TowingDetailsSection,
  TowingVehicleType,
} from '@/components/damage-post/TowingDetailsSection';
import {
  RoadsideDetailsSection,
  RoadsideKind,
} from '@/components/damage-post/RoadsideDetailsSection';
import {
  DamageCategorySection,
  PostServiceCategory,
} from '@/components/damage-post/DamageCategorySection';

export default function PostDamageScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const auth = useAuth();

  const [vehicleMake, setVehicleMake] = useState('Maruti Suzuki');
  const [vehicleModel, setVehicleModel] = useState('Swift');
  const [vehicleYear, setVehicleYear] = useState('2023');
  const [category, setCategoryState] = useState<PostServiceCategory>('REPAIR');
  const [selectedPart, setSelectedPart] = useState('Front Bumper & Grille');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('URGENT');
  const [fulfillmentType, setFulfillmentType] = useState<
    'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE' | 'TOW_TO_GARAGE'
  >('PARTS_SHIPPING');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [towingVehicleType, setTowingVehicleType] =
    useState<TowingVehicleType>('FLATBED');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [vehicleWeightKg, setVehicleWeightKg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTowing = category === 'TOWING';
  const [roadsideKind, setRoadsideKind] = useState<RoadsideKind | null>(null);
  const isRoadside = category === 'ROADSIDE';

  const geocodeAddress = async (address: string) => {
    const results = await Location.geocodeAsync(address.trim());
    return results[0];
  };

  const handleEstimateTowingFare = async () => {
    if (dropoffAddress.trim().length < 3) return null;

    const [position, dropoff] = await Promise.all([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      geocodeAddress(dropoffAddress),
    ]);

    if (!dropoff) {
      Alert.alert(
        'Address Not Found',
        'We could not locate that dropoff address. Please make it more specific.',
      );
      return null;
    }

    const distanceKm = haversineDistanceKm(
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      { latitude: dropoff.latitude, longitude: dropoff.longitude },
    );

    return { distanceKm, fare: estimateTowingFare(distanceKm) };
  };

  const setCategory = (next: PostServiceCategory) => {
    setCategoryState(next);
    if (next === 'TOWING') {
      setFulfillmentType('TOW_TO_GARAGE');
    }
  };

  const handleSubmit = async () => {
    if (!description.trim() && !photoUri) {
      Alert.alert(
        'Details Required',
        'Please upload a damage photo or describe the issue so mechanics can accurately quote.',
      );
      return;
    }

    if (isRoadside && !roadsideKind) {
      Alert.alert(
        'Assist Type Required',
        'Tell us what happened — battery, tyre, or fuel — so the right providers get the request.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Weyro needs your location to match this request with nearby workshops and parts dealers.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let dropoff:
        | { latitude: number; longitude: number }
        | undefined;

      if (isTowing) {
        if (dropoffAddress.trim().length < 3) {
          Alert.alert(
            'Dropoff Required',
            'Enter the address where the vehicle should be towed.',
          );
          return;
        }

        const geocoded = await geocodeAddress(dropoffAddress);
        if (!geocoded) {
          Alert.alert(
            'Address Not Found',
            'We could not locate that dropoff address. Please make it more specific.',
          );
          return;
        }

        dropoff = {
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
        };
      }

      let address = 'Current location';
      try {
        const [place] = await Location.reverseGeocodeAsync(position.coords);
        if (place) {
          address =
            [place.name, place.street, place.city, place.region]
              .filter(Boolean)
              .join(', ') || address;
        }
      } catch {
        // Reverse geocoding is best-effort; coordinates are still valid.
      }

      const created = await damageRequestStore.createBroadcastRequest({
        customerName: auth.user?.name || 'Customer',
        vehicleMake: vehicleMake.trim() || 'Generic',
        vehicleModel: vehicleModel.trim() || 'Vehicle',
        vehicleYear: parseInt(vehicleYear, 10) || new Date().getFullYear(),
        category,
        damagedPart: isTowing ? 'Vehicle towing required' : selectedPart,
        description:
          description.trim() ||
          (isTowing
            ? 'Vehicle towing required.'
            : `${selectedPart} replacement required.`),
        urgency,
        fulfillmentType,
        damagePhotos: photoUri ? [photoUri] : [],
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address,
        dropoffAddress: isTowing ? dropoffAddress.trim() : undefined,
        dropoffLatitude: dropoff?.latitude,
        dropoffLongitude: dropoff?.longitude,
        towingVehicleType: isTowing ? towingVehicleType : undefined,
        vehicleWeightKg:
          isTowing && vehicleWeightKg.trim()
            ? parseInt(vehicleWeightKg, 10) || undefined
            : undefined,
        roadsideKind: isRoadside ? roadsideKind || undefined : undefined,
      });

      const roadsideSummary =
        created.roadsideKind &&
        created.estimatedFare !== undefined
          ? `\n\nFlat-rate estimate: ₹${created.estimatedFare.toLocaleString(
              'en-IN',
            )} (final quote from the operator may vary).`
          : '';

      const towingSummary =
        created.towingDistanceKm !== undefined &&
        created.towingEstimatedFare !== undefined
          ? `\n\nEstimated distance: ${created.towingDistanceKm.toFixed(
              1,
            )} km\nEstimated fare: ₹${created.towingEstimatedFare.toLocaleString(
              'en-IN',
            )} (final quote from the operator may vary).`
          : '';

      Alert.alert(
        'Request Broadcast Live! 🚀',
        isTowing
          ? `Your towing request has been dispatched to verified towing operators near you.${towingSummary}`
          : isRoadside
            ? `Your roadside assist request has been dispatched to verified providers near you.${roadsideSummary}`
            : 'Your repair request has been dispatched to local workshops and verified parts dealers.',
        [{ text: 'View Bids', onPress: () => router.push('/quotes') }],
      );
    } catch {
      Alert.alert('Error', 'Unable to broadcast request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: safeAreaInsets.top + Spacing.three,
            paddingBottom: Spacing.six,
          },
        ]}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              {isTowing
                ? 'Request a Tow'
                : isRoadside
                  ? 'Roadside Assist'
                  : 'Post Car Damage'}
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
              {isTowing
                ? 'Broadcast your towing request to verified towing operators near you.'
                : isRoadside
                  ? 'Flat-rate on-site assist: battery, tyre or fuel — dispatched to verified providers near you.'
                  : 'Broadcast your vehicle issue to verified workshops and parts suppliers across India.'}
            </ThemedText>
          </View>

          {/* Shop quick link — makes the two services explicit */}
          <Pressable
            onPress={() => router.push('/spare-parts')}
            accessibilityRole="button"
            accessibilityLabel="Open the shop for parts and service packages"
            style={{
              alignSelf: 'flex-start',
              marginTop: Spacing.two,
              marginBottom: Spacing.one,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.primary,
              backgroundColor: theme.primarySurface,
            }}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              🛒 Browse the Shop — parts &amp; service packages
            </ThemedText>
          </Pressable>

          <DamageCategorySection
            category={category}
            setCategory={setCategory}
          />

          <DamageVehicleSection
            vehicleMake={vehicleMake}
            setVehicleMake={setVehicleMake}
            vehicleModel={vehicleModel}
            setVehicleModel={setVehicleModel}
            vehicleYear={vehicleYear}
            setVehicleYear={setVehicleYear}
            selectedPart={selectedPart}
            setSelectedPart={setSelectedPart}
            description={description}
            setDescription={setDescription}
            isTowing={isTowing}
          />

          <DamagePhotoUploader
            photoUri={photoUri}
            setPhotoUri={setPhotoUri}
          />

          {isTowing && (
            <TowingDetailsSection
              vehicleType={towingVehicleType}
              setVehicleType={setTowingVehicleType}
              dropoffAddress={dropoffAddress}
              setDropoffAddress={setDropoffAddress}
              vehicleWeightKg={vehicleWeightKg}
              setVehicleWeightKg={setVehicleWeightKg}
              onEstimate={handleEstimateTowingFare}
            />
          )}

          {isRoadside && (
            <RoadsideDetailsSection
              kind={roadsideKind}
              setKind={setRoadsideKind}
            />
          )}

          <DamageFulfillmentSection
            urgency={urgency}
            setUrgency={setUrgency}
            fulfillmentType={fulfillmentType}
            setFulfillmentType={setFulfillmentType}
            sectionNumber={isTowing ? 4 : 3}
            hideServiceMode={isTowing}
          />
        </View>
      </ScrollView>

      {/* Floating primary CTA */}
      <View style={[styles.fabContainer, { bottom: safeAreaInsets.bottom + Spacing.three }]}>
        <Pressable
          accessibilityLabel={isSubmitting ? 'Broadcasting request...' : 'Broadcast damage request to workshops and dealers'}
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={[
            styles.fab,
            { backgroundColor: theme.primary },
            isSubmitting && { opacity: 0.7 },
          ]}>
          <ThemedText style={[styles.fabText, { color: theme.inverseText }]}>
            {isSubmitting ? 'Broadcasting...' : 'Broadcast Request 📡'}
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    marginBottom: Spacing.four,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.half,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  fabContainer: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  fab: {
    height: 56,
    borderRadius: BorderRadius.xlarge,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.floating,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
