import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Home,
  Package,
  Truck,
  Wrench,
} from 'lucide-react-native';
import {
  ScreenContainer,
  AppHeader,
  SectionCard,
  ListItem,
  StatusPill,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const SERVICES = [
  {
    key: 'REPAIR',
    title: 'Vehicle Repair',
    subtitle: 'Get quotes from verified mechanics and garages.',
    Icon: Wrench,
    tone: 'info' as const,
  },
  {
    key: 'SPARE_PART',
    title: 'Spare Parts',
    subtitle: 'Find genuine and aftermarket parts.',
    Icon: Package,
    tone: 'neutral' as const,
  },
  {
    key: 'TOWING',
    title: 'Towing',
    subtitle: 'Request roadside assistance and vehicle transport.',
    Icon: Truck,
    tone: 'warning' as const,
  },
  {
    key: 'ROADSIDE',
    title: 'Home Mechanic',
    subtitle: 'Arrange a mechanic visit at your location.',
    Icon: Home,
    tone: 'info' as const,
  },
];

export default function ServiceSelectionScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
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
              onPress={() =>
                router.push(`/requests/create?category=${s.key}`)
              }
              accessibilityRole="button"
              accessibilityLabel={s.title}
              className="active:bg-accent/10"
              style={styles.card}
            >
              <View style={styles.iconWrap}>
                {(() => {
                  const Icon = s.Icon;
                  return <Icon size={28} color={palette.accent} strokeWidth={2} />;
                })()}
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardSubtitle}>{s.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={palette.textMuted} strokeWidth={2} />
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Need help deciding?</Text>
        <Text style={styles.sectionSubtitle}>
          Not sure which service fits? Describe your issue when creating a
          request and nearby providers will recommend the right service.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Popular nearby</Text>
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
          onPress={() => router.push('/requests/create?category=REPAIR')}
          accessibilityLabel="Engine oil change"
        />
        <ListItem
          bare
          title="Wheel alignment"
          subtitle="Tata Nexon · 2022"
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
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    ...typography.body,
    color: palette.textSecondary,
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
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  iconWrap: {
    width: 52,
    height: '100%',
    backgroundColor: palette.surfaceAlt,
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
    color: palette.textPrimary,
  },
  cardSubtitle: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginBottom: spacing.lg,
  },
});
