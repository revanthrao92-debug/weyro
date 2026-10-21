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

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { damageRequestStore } from '@/services/damage-request-store';
import { useAuth } from '@/services/auth-store';
import { DamageVehicleSection } from '@/components/damage-post/DamageVehicleSection';
import { DamagePhotoUploader } from '@/components/damage-post/DamagePhotoUploader';
import { DamageFulfillmentSection } from '@/components/damage-post/DamageFulfillmentSection';

export default function PostDamageScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const auth = useAuth();

  const [vehicleMake, setVehicleMake] = useState('Maruti Suzuki');
  const [vehicleModel, setVehicleModel] = useState('Swift');
  const [vehicleYear, setVehicleYear] = useState('2023');
  const [selectedPart, setSelectedPart] = useState('Front Bumper & Grille');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('URGENT');
  const [fulfillmentType, setFulfillmentType] = useState<
    'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE'
  >('PARTS_SHIPPING');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim() && !photoUri) {
      Alert.alert(
        'Details Required',
        'Please upload a damage photo or describe the issue so mechanics can accurately quote.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      damageRequestStore.createBroadcastRequest({
        customerName: auth.user?.name || 'Customer',
        vehicleMake: vehicleMake.trim() || 'Generic',
        vehicleModel: vehicleModel.trim() || 'Vehicle',
        vehicleYear: parseInt(vehicleYear, 10) || new Date().getFullYear(),
        damagedPart: selectedPart,
        description: description.trim() || `${selectedPart} replacement required.`,
        urgency,
        fulfillmentType,
        damagePhotos: photoUri ? [photoUri] : [],
      });

      Alert.alert(
        'Request Broadcast Live! 🚀',
        'Your repair request has been dispatched to local workshops and verified parts dealers.',
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
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: theme.primarySurface }]}>
              <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                WEYRO INSTANT REPAIR DISPATCH
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Post Car Damage
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
              Broadcast your vehicle issue to verified workshops and parts suppliers across India.
            </ThemedText>
          </View>

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
          />

          <DamagePhotoUploader
            photoUri={photoUri}
            setPhotoUri={setPhotoUri}
          />

          <DamageFulfillmentSection
            urgency={urgency}
            setUrgency={setUrgency}
            fulfillmentType={fulfillmentType}
            setFulfillmentType={setFulfillmentType}
          />

          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              { backgroundColor: theme.primary },
              isSubmitting && { opacity: 0.7 },
            ]}>
            <ThemedText style={[styles.submitText, { color: theme.inverseText }]}>
              {isSubmitting ? 'Broadcasting...' : 'Broadcast to Workshops & Dealers 📡'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
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
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: Spacing.one,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
