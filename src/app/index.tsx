import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { damageRequestStore } from '@/services/damage-request-store';
import { useAuth } from '@/services/auth-store';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const COMMON_DAMAGED_PARTS = [
  'Front Bumper & Grille',
  'Headlight / Lamp Unit',
  'Side Door & Panel',
  'Radiator & Cooling',
  'Windshield & Glass',
  'Suspension & Axle',
  'Engine Compartment',
  'Rear Bumper & Trunk',
];

export default function PostDamageScreen() {
  const router = useRouter();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const auth = useAuth();

  const [customerName, setCustomerName] = useState(auth.user.name || 'Marcus Vance');
  const [vehicleMake, setVehicleMake] = useState('BMW');
  const [vehicleModel, setVehicleModel] = useState('330i M-Sport');
  const [vehicleYear, setVehicleYear] = useState('2022');
  const [selectedPart, setSelectedPart] = useState('Front Bumper & Grille');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('URGENT');
  const [fulfillmentType, setFulfillmentType] = useState<
    'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE'
  >('PARTS_SHIPPING');

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const uploadToServer = async (base64: string, mimeType: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/damage-requests/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          setPhotoUri(data.url);
        }
      }
    } catch {
      // Graceful fallback: maintain local photoUri
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsPickingImage(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Photo library access is needed to upload car damage photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        if (asset.base64) {
          uploadToServer(asset.base64, asset.mimeType || 'image/jpeg');
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open image picker.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      setIsPickingImage(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Camera access is needed to capture damaged car parts.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        if (asset.base64) {
          uploadToServer(asset.base64, asset.mimeType || 'image/jpeg');
        }
      }
    } catch {
      Alert.alert('Error', 'Camera unavailable or not supported in this environment.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert('Missing details', 'Please describe the damage or part required.');
      return;
    }

    const created = damageRequestStore.addRequest({
      customerName: customerName.trim() || 'Vehicle Owner',
      vehicleMake: vehicleMake.trim() || 'Vehicle',
      vehicleModel: vehicleModel.trim() || 'Model',
      vehicleYear: parseInt(vehicleYear, 10) || 2022,
      damagedPart: selectedPart,
      description: description.trim(),
      urgency,
      fulfillmentType,
      damagePhotos: photoUri
        ? [photoUri]
        : [
            'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
          ],
    });

    setSubmittedId(created.id);
  };

  const handleReset = () => {
    setSubmittedId(null);
    setDescription('');
    setPhotoUri(null);
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
        {submittedId ? (
          <ThemedView type="backgroundElement" style={styles.successCard}>
            <View style={styles.broadcastPill}>
              <ThemedText style={styles.broadcastPillText}>
                📡 BROADCASTED TO ALL PROVIDERS
              </ThemedText>
            </View>

            <ThemedText type="subtitle" style={styles.successTitle}>
              Damage Request Dispatched
            </ThemedText>
            <ThemedText style={styles.successBody} themeColor="textSecondary">
              Your damaged part photo and details have been sent to all registered
              mechanics, garages, and spare-parts dealers irrespective of distance and
              time constraints.
            </ThemedText>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => router.push('/quotes')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}>
                <ThemedText style={styles.primaryButtonText}>
                  Track Quotes Received 💬
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}>
                <ThemedText style={styles.secondaryButtonText}>
                  View in Provider Feed 📡
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}>
                <ThemedText style={styles.secondaryButtonText}>
                  Post Another Damage Request
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ) : (
          <View style={styles.formWrapper}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.topBadgeRow}>
                <View style={styles.broadcastBadge}>
                  <ThemedText style={styles.broadcastBadgeText}>
                    BROADCAST MODE • ANY DISTANCE & TIME
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => router.push('/auth')}
                  style={({ pressed }) => [
                    styles.accountChip,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <ThemedText style={styles.accountChipText}>
                    👤 {auth.user.name.split(' ')[0]} ({auth.user.role})
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                Post Car Damage Request
              </ThemedText>
              <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
                Take a photo of the damaged part. The request is broadcast to all
                dealers & mechanics across all locations so you receive competitive quotes.
              </ThemedText>
            </View>

            {/* Vehicle & Owner Details */}
            <ThemedView type="backgroundElement" style={styles.sectionCard}>
              <ThemedText type="smallBold" style={styles.cardHeaderTitle}>
                1. Vehicle & Owner Details
              </ThemedText>

              <View style={styles.inputGroup}>
                <ThemedText type="small" themeColor="textSecondary">
                  Your Name / Contact
                </ThemedText>
                <TextInput
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="e.g. Marcus Vance"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.textInput,
                    { color: theme.text, backgroundColor: theme.background },
                  ]}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Make & Model
                  </ThemedText>
                  <TextInput
                    value={`${vehicleMake} ${vehicleModel}`}
                    onChangeText={(val) => {
                      const parts = val.split(' ');
                      setVehicleMake(parts[0] || '');
                      setVehicleModel(parts.slice(1).join(' '));
                    }}
                    placeholder="e.g. BMW 330i"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.textInput,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Year
                  </ThemedText>
                  <TextInput
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    keyboardType="numeric"
                    placeholder="2022"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.textInput,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                  />
                </View>
              </View>
            </ThemedView>

            {/* Damaged Part Selection */}
            <ThemedView type="backgroundElement" style={styles.sectionCard}>
              <ThemedText type="smallBold" style={styles.cardHeaderTitle}>
                2. Select Damaged Component
              </ThemedText>
              <View style={styles.chipGrid}>
                {COMMON_DAMAGED_PARTS.map((part) => {
                  const isSelected = selectedPart === part;
                  return (
                    <Pressable
                      key={part}
                      onPress={() => setSelectedPart(part)}
                      style={[
                        styles.chip,
                        isSelected
                          ? styles.chipSelected
                          : { backgroundColor: theme.background },
                      ]}>
                      <ThemedText
                        type="small"
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}>
                        {part}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ThemedView>

            {/* Photo of Damaged Part */}
            <ThemedView type="backgroundElement" style={styles.sectionCard}>
              <ThemedText type="smallBold" style={styles.cardHeaderTitle}>
                3. Photo of Damaged Part
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Dealers and mechanics inspect your photo to estimate repair time and part availability.
              </ThemedText>

              {photoUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.imagePreview}
                    contentFit="cover"
                  />
                  <View style={styles.imageActionsRow}>
                    <Pressable
                      onPress={handleTakePhoto}
                      style={styles.imageActionButton}>
                      <ThemedText type="smallBold" style={styles.actionButtonText}>
                        Retake Photo
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setPhotoUri(null)}
                      style={[styles.imageActionButton, styles.removeButton]}>
                      <ThemedText type="smallBold" style={styles.removeButtonText}>
                        Remove
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPickerContainer}>
                  <View style={styles.photoButtonGroup}>
                    <Pressable
                      onPress={handleTakePhoto}
                      disabled={isPickingImage}
                      style={({ pressed }) => [
                        styles.photoButton,
                        pressed && styles.buttonPressed,
                      ]}>
                      {isPickingImage ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <ThemedText style={styles.photoButtonText}>
                          📷 Take Damage Photo
                        </ThemedText>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={handlePickFromGallery}
                      disabled={isPickingImage}
                      style={({ pressed }) => [
                        styles.photoOutlineButton,
                        { borderColor: theme.textSecondary },
                        pressed && styles.buttonPressed,
                      ]}>
                      <ThemedText style={styles.photoOutlineButtonText}>
                        🖼️ Upload from Gallery
                      </ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText type="small" style={styles.photoHintText} themeColor="textSecondary">
                    (If skipped, a demo reference damage photo will be attached)
                  </ThemedText>
                </View>
              )}
            </ThemedView>

            {/* Description & Requirements */}
            <ThemedView type="backgroundElement" style={styles.sectionCard}>
              <ThemedText type="smallBold" style={styles.cardHeaderTitle}>
                4. Damage Description & Needs
              </ThemedText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe visible damage, cracked parts, whether vehicle is drivable, or part numbers if known..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                style={[
                  styles.textArea,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
              />

              {/* Urgency Level */}
              <ThemedText type="small" style={styles.subLabel} themeColor="textSecondary">
                Urgency Level:
              </ThemedText>
              <View style={styles.fulfillmentRow}>
                {(['NORMAL', 'URGENT', 'EMERGENCY'] as const).map((level) => (
                  <Pressable
                    key={level}
                    onPress={() => setUrgency(level)}
                    style={[
                      styles.fulfillmentPill,
                      urgency === level
                        ? styles.chipSelected
                        : { backgroundColor: theme.background },
                    ]}>
                    <ThemedText
                      type="small"
                      style={[
                        styles.chipText,
                        urgency === level && styles.chipTextSelected,
                      ]}>
                      {level}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {/* Fulfillment Options */}
              <ThemedText type="small" style={styles.subLabel} themeColor="textSecondary">
                Fulfillment Preference:
              </ThemedText>
              <View style={styles.fulfillmentRow}>
                {[
                  { key: 'PARTS_SHIPPING', label: 'Parts Courier' },
                  { key: 'WORKSHOP_VISIT', label: 'Garage Visit' },
                  { key: 'ON_SITE', label: 'On-Site Fix' },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() =>
                      setFulfillmentType(
                        item.key as 'PARTS_SHIPPING' | 'WORKSHOP_VISIT' | 'ON_SITE'
                      )
                    }
                    style={[
                      styles.fulfillmentPill,
                      fulfillmentType === item.key
                        ? styles.chipSelected
                        : { backgroundColor: theme.background },
                    ]}>
                    <ThemedText
                      type="small"
                      style={[
                        styles.chipText,
                        fulfillmentType === item.key && styles.chipTextSelected,
                      ]}>
                      {item.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ThemedView>

            {/* Broadcast Guarantee Notice */}
            <View style={styles.broadcastBanner}>
              <ThemedText style={styles.broadcastBannerIcon}>📡</ThemedText>
              <View style={styles.broadcastBannerTextWrapper}>
                <ThemedText type="smallBold" style={styles.broadcastBannerTitle}>
                  Broadcast Scope: Unlimited
                </ThemedText>
                <ThemedText type="small" style={styles.broadcastBannerDesc}>
                  Distance and dispatch time filters are bypassed. Mechanics and
                  spare-part dealers nationwide will receive this request.
                </ThemedText>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
              ]}>
              <ThemedText style={styles.submitButtonText}>
                Broadcast Damage Request 🚀
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  formWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountChip: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: 8,
  },
  accountChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  broadcastBadge: {
    backgroundColor: '#0F52BA',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  broadcastBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionCard: {
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.two,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inputGroup: {
    gap: Spacing.one,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  chipSelected: {
    backgroundColor: '#0F52BA',
  },
  chipText: {
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  photoPickerContainer: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  photoButtonGroup: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#0F52BA',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  photoOutlineButton: {
    flex: 1,
    borderWidth: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOutlineButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  photoHintText: {
    fontSize: 12,
    textAlign: 'center',
  },
  imagePreviewContainer: {
    marginTop: Spacing.two,
    borderRadius: 14,
    overflow: 'hidden',
    gap: Spacing.two,
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  imageActionButton: {
    flex: 1,
    height: 38,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
  },
  removeButton: {
    backgroundColor: '#8B0000',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 13,
  },
  textArea: {
    minHeight: 90,
    borderRadius: 10,
    padding: Spacing.three,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  subLabel: {
    marginTop: Spacing.one,
  },
  fulfillmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  fulfillmentPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  broadcastBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 82, 186, 0.12)',
    borderColor: '#0F52BA',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  broadcastBannerIcon: {
    fontSize: 24,
  },
  broadcastBannerTextWrapper: {
    flex: 1,
    gap: Spacing.half,
  },
  broadcastBannerTitle: {
    color: '#0F52BA',
    fontSize: 14,
  },
  broadcastBannerDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    backgroundColor: '#0F52BA',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  successCard: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    borderRadius: 20,
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.four,
  },
  broadcastPill: {
    backgroundColor: '#0F52BA',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 20,
  },
  broadcastPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  successBody: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    width: '100%',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#0F52BA',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0F52BA',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#0F52BA',
    fontSize: 15,
    fontWeight: '600',
  },
});
