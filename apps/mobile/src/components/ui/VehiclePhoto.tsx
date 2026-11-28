import { View, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';
import { carPhotoFor } from '@/lib/photos';
import { palette } from '@/theme';

/** Stock photo for the vehicle's make, or a neutral car icon when we have none. */
export function VehiclePhoto({
  make,
  model,
  style,
  iconSize = 20,
}: {
  make?: string | null;
  model?: string | null;
  style: StyleProp<ImageStyle>;
  iconSize?: number;
}) {
  const uri = carPhotoFor(make, model);
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" transition={150} />;
  }
  return (
    <View
      style={[style as object, { alignItems: 'center', justifyContent: 'center' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Car size={iconSize} color={palette.textMuted} strokeWidth={1.6} />
    </View>
  );
}
