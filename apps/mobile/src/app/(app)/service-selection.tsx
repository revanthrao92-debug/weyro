import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Home, Package, Truck, Wrench } from 'lucide-react-native';
import {
  ScreenContainer,
  AppHeader,
  ListItem,
  StatusPill,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const SERVICES = [
  {
    key: 'REPAIR',
    title: 'Vehicle Repair',
    subtitle: 'Get quotes from mechanics and garages.',
    Icon: Wrench,
  },
  {
    key: 'SPARE_PART',
    title: 'Spare Parts',
    subtitle: 'Find genuine and aftermarket parts.',
    Icon: Package,
  },
  {
    key: 'TOWING',
    title: 'Towing',
    subtitle: 'Request roadside assistance and transport.',
    Icon: Truck,
  },
  {
    key: 'ROADSIDE',
    title: 'Home Mechanic',
    subtitle: 'Arrange a mechanic visit at your location.',
    Icon: Home,
  },
];

export default function ServiceSelectionScreen() {
  const router = useRouter();
  const dark = palette.header;

  return (
    <ScreenContainer chrome="dark">
      <AppHeader
        logo={require('../../../assets/images/weyro-logo.png')}
        subtitle="Choose a service to get started."
      />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.pageTitle}>What do you need help with?</Text>
        <Text style={styles.pageSubtitle}>
          Select the service that matches your vehicle need.
        </Text>

        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => router.push(`/requests/create?category=${s.key}`)}
              accessibilityRole="button"
              accessibilityLabel={s.title}
              className="active:opacity-70"
              style={[styles.card, { backgroundColor: '#0C2330' }]}
            >
              <View style={styles.iconWrap}>
                <s.Icon size={26} color={palette.accent} strokeWidth={1.75} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle} maxFontSizeMultiplier={2}>
                  {s.title}
                </Text>
                <Text style={styles.cardSubtitle} maxFontSizeMultiplier={2}>
                  {s.subtitle}
                </Text>
              </View>
              <ChevronRight size={18} color={palette.onHeaderMuted} strokeWidth={2} />
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Need help deciding?</Text>
        <Text style={styles.sectionSubtitle}>
          Not sure which service fits? Describe your issue when creating a
          request and nearby providers recommend the right service.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitleDark}>Popular nearby</Text>
        <ListItem
          bare
          title="Brake pad replacement"
          subtitle="Hyundai Creta · 2023"
          right={<StatusPill label="Open" tone="info" />}
          onPress={() => router.push('/requests/create?category=REPAIR')}
          accessibilityLabel="Brake pad replacement"
        />
        <ListItem
          bare
          divider
          title="Engine oil change"
          subtitle="Maruti Suzuki Swift · 2021"
          right={<StatusPill label="Open" tone="info" />}
          onPress={() => router.push(`/requests/create?category=REPAIR`)}
          accessibilityLabel="Engine oil change"
        />
        <ListItem
          bare
          title="Wheel alignment"
          subtitle={`Tata Nexon · 2022`}
          right={<StatusPill label="Open" tone="info" />}
          onPress={() => router.push('/requests/create?category=REPAIR')}
          accessibilityLabel="Wheel alignment"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  pageTitle: {
    ...typography.heading,
    color: palette.onHeader,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    ...typography.body,
    color: palette.onHeaderMuted,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: (375 - 32 - 16) / 2,
    height: 130,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  iconWrap: {
    width: 52,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: palette.onHeader,
  },
  cardSubtitle: {
    ...typography.caption,
    color: palette.onHeaderMuted,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: palette.onHeader,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body,
    color: palette.onHeaderMuted,
    marginBottom: spacing.lg,
  },
  sectionTitleDark: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
});
