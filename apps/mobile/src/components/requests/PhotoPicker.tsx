import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Plus, X } from 'lucide-react-native';
import { uploadImage, type UploadFolder, type UploadedImage } from '@/services/uploads';
import { palette, spacing, radii, typography } from '@/theme';

export interface PhotoPickerProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** Max number of photos. Default 4. */
  max?: number;
  folder?: UploadFolder;
  /** Notifies the parent while uploads are in flight (e.g. to disable submit). */
  onUploadingChange?: (busy: boolean) => void;
  /** Replaces the default helper line. */
  helper?: string;
}

const TILE = 92;

/**
 * Photo attachment grid: thumbnails with remove buttons + an "Add photo" tile
 * that offers camera or library. Uploads immediately via presign/PUT/finalize
 * and reports the resulting URLs.
 */
export function PhotoPicker({
  images,
  onChange,
  max = 4,
  folder = 'damage-requests',
  onUploadingChange,
  helper,
}: PhotoPickerProps) {
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, max - images.length);

  async function uploadAssets(assets: ImagePicker.ImagePickerAsset[]) {
    if (assets.length === 0) return;
    setBusy(true);
    onUploadingChange?.(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const asset of assets.slice(0, remaining)) {
        uploaded.push(
          await uploadImage(asset.uri, folder, {
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
          })
        );
      }
      onChange([...images, ...uploaded]);
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not upload the photo.');
    } finally {
      setBusy(false);
      onUploadingChange?.(false);
    }
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach damage photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (!result.canceled) await uploadAssets(result.assets);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) await uploadAssets(result.assets);
  }

  function addTapped() {
    if (busy || remaining === 0) return;
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => void takePhoto() },
      { text: 'Choose from library', onPress: () => void pickFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.grid}>
      {images.map((image, index) => (
        <View key={`${image.key}-${index}`} style={styles.tile}>
          <Image source={{ uri: image.url }} style={styles.thumb} contentFit="cover" />
          <Pressable
            onPress={() => onChange(images.filter((_, i) => i !== index))}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${index + 1}`}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <X size={14} color={palette.white} strokeWidth={2.5} />
          </Pressable>
        </View>
      ))}

      {remaining > 0 ? (
        <Pressable
          onPress={addTapped}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          className="active:bg-accent"
          style={styles.addTile}
        >
          {busy ? (
            <ActivityIndicator color={palette.accent} accessibilityLabel="Uploading photo" />
          ) : (
            <>
              <Plus size={22} color={palette.textSecondary} strokeWidth={2} />
              <Text style={styles.addLabel} maxFontSizeMultiplier={2}>
                Add photo
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {images.length === 0 && !busy ? (
        <View style={styles.hint}>
          <Camera size={16} color={palette.textMuted} strokeWidth={2} />
          <Text style={styles.hintText} maxFontSizeMultiplier={2}>
            {helper ?? `Up to ${max} photos help providers quote accurately.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.overlay,
  },
  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: {
    ...typography.label,
    color: palette.textSecondary,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintText: {
    ...typography.label,
    color: palette.textMuted,
    flexShrink: 1,
  },
});

export default PhotoPicker;
