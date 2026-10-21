import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { uploadImageViaPresignedUrl } from '@/services/upload-helper';

interface DamagePhotoUploaderProps {
  photoUri: string | null;
  setPhotoUri: (uri: string | null) => void;
}

export function DamagePhotoUploader({
  photoUri,
  setPhotoUri,
}: DamagePhotoUploaderProps) {
  const theme = useTheme();
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Camera / photo library access is needed to capture damaged vehicle components.',
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);

        // Upload to S3/R2 asynchronously via presigned URL
        setIsUploading(true);
        try {
          const publicUrl = await uploadImageViaPresignedUrl(
            asset.uri,
            asset.mimeType || 'image/jpeg',
          );
          setPhotoUri(publicUrl);
        } catch (err: any) {
          if (err?.status === 429) {
            Alert.alert(
              'Upload Rate Limit',
              'You have requested too many image uploads. Please wait 60 seconds before trying again.',
            );
          } else {
            console.warn('Presigned upload fallback to local URI:', err?.message);
          }
        } finally {
          setIsUploading(false);
        }
      }
    } catch {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        2. DAMAGE PHOTO (REQUIRED FOR AI / QUOTES)
      </ThemedText>

      {photoUri ? (
        <View style={[styles.previewContainer, Elevation.medium, { borderRadius: BorderRadius.large }]}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" />
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color={theme.inverseText} />
              <ThemedText style={[styles.uploadingText, { color: theme.inverseText }]}>Uploading to Secure Cloud...</ThemedText>
            </View>
          )}
          <Pressable
            onPress={() => setPhotoUri(null)}
            style={styles.removeButton}>
            <ThemedText style={[styles.removeButtonText, { color: theme.inverseText }]}>Remove Photo</ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => handlePickImage(false)}
            style={[styles.pickerButton, { borderColor: theme.border }]}>
            <ThemedText style={styles.buttonText}>📁 Upload from Gallery</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handlePickImage(true)}
            style={[styles.pickerButton, { borderColor: theme.border }]}>
            <ThemedText style={styles.buttonText}>📷 Take Photo</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pickerButton: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewContainer: {
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
