import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Home, Package, Truck, Wrench } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import {
  ScreenContainer,
  AppHeader,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

/**
 * "Request a Service" — reference photo 2.
 * Dark chrome + full-bleed image cards. Each card: automotive photo with a
 * deep navy overlay, icon chip, title + subtitle, chevron.
 * If a remote photo fails to load, the dark card + icon remain (graceful).
 */

const SERVICES = [
  {
    key: 'REPAIR',
    title: 'Vehicle Repair',
    subtitle: 'Get quotes from trusted mechanics and garages',
    Icon: Wrench,
    photo: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
  },
  {
    key: 'SPARE_PART',
    title: 'Spare Parts',
    subtitle: 'Find genuine and aftermarket parts at the best prices',
    Icon: Package,
    photo: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=900&q=80',
  },
  {
    key: 'TOWING',
    title: 'Towing',
    subtitle: '24/7 roadside assistance and towing services',
    Icon: Truck,
    photo: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd6?auto=format&fit=crop&w=900&q=80',
  },
  {
    key: 'ROADSIDE',
    title: 'Home Mechanic',
    subtitle: 'Expert mechanics at your location',
    Icon: Home,
    photo: null,
  },
];

function ServiceCard({
  title,
  subtitle,
  Icon,
  photo,
  onPress,
}: {
  title: string;
  subtitle: string;
  Icon: typeof Wrench;
  photo: string | null;
  onPress: () => void;
}) {
  const [photoOk, setPhotoOk] = useState(true);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="active:opacity-80"
      style={styles.card}
    >
      {photo && photoOk ? (
        <ExpoImage
          source={{ uri: photo }}
          style={styles.cardPhoto}
          contentFit="cover"
          onError={() => setPhotoOk(false)}
        />
      ) : null}
      <View style={styles.cardShade} />
      <View style={styles.cardInner}>
        <View style={styles.iconChip}>
          <Icon size={20} color={palette.onHeader} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={2}>
            {title}
          </Text>
          <Text style={styles.cardSubtitle} maxFontSizeMultiplier={2}>
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={18} color={palette.onHeaderMuted} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

export default function ServiceSelectionScreen() {
  const router = useRouter();

  return (
    <ScreenContainer chrome="dark" padded={false}>
      <AppHeader
        title="Request a Service"
        subtitle="Choose a service to get started."
        left={null}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle} maxFontSizeMultiplier={1.4}>
          What do you need{'\n'}help with?
        </Text>

        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <ServiceCard
              {...s}
              key={s.key}
              onPress={() => router.push(`/requests/create?category=${s.key}`)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  pageTitle: {
    ...typography.display,
    color: palette.onHeader,
    marginBottom: spacing.lg,
  },

  grid: { gap: spacing.md },

  card: {
    height: 108,
    borderRadius: radii.lg,
    backgroundColor: '#0C2330', // deep panel (fallback behind photo)
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardPhoto: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 21, 30, 0.78)',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.heading,
    color: palette.onHeader,
  },
  cardSubtitle: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: 2,
  },
});
