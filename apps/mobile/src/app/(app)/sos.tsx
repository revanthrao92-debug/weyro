import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BatteryCharging,
  Fuel,
  LifeBuoy,
  Truck,
  ChevronRight,
} from 'lucide-react-native';
import {
  ScreenContainer,
  BackButton,
  PressableScale,
  Surface,
  Section,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const OPTIONS = [
  {
    key: 'BATTERY',
    label: 'Battery jumpstart',
    hint: 'Flat battery, no start',
    Icon: BatteryCharging,
    category: 'ROADSIDE',
    title: 'Battery jumpstart',
  },
  {
    key: 'TYRE',
    label: 'Tyre assistance',
    hint: 'Puncture, air, wheel change',
    Icon: LifeBuoy,
    category: 'ROADSIDE',
    title: 'Tyre assistance',
  },
  {
    key: 'FUEL',
    label: 'Fuel delivery',
    hint: 'Petrol or diesel on the spot',
    Icon: Fuel,
    category: 'ROADSIDE',
    title: 'Fuel delivery',
  },
  {
    key: 'TOW',
    label: 'Wheel-lift tow',
    hint: 'Move the vehicle safely',
    Icon: Truck,
    category: 'TOWING',
    title: 'Wheel-lift tow',
  },
];

export default function SosScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind?: string }>();

  const start = (option: (typeof OPTIONS)[number]) => {
    router.push(
      `/requests/create?category=${option.category}&urgency=EMERGENCY&title=${encodeURIComponent(
        option.title
      )}`
    );
  };

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>SOS</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={styles.title}>Roadside assistance</Text>
        <Text style={styles.subtitle}>
          Send an emergency request. Verified providers nearby respond with a
          price and ETA.
        </Text>

        <View style={styles.grid}>
          {OPTIONS.map((option) => {
            const selected = kind === option.key;
            return (
              <PressableScale
                key={option.key}
                onPress={() => start(option)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                scaleTo={0.96}
                style={[styles.tile, selected && styles.tileSelected]}
              >
                <View style={styles.iconWrap}>
                  <option.Icon
                    size={22}
                    color={selected ? palette.accent : palette.textSecondary}
                    strokeWidth={1.7}
                  />
                </View>
                <Text style={styles.tileTitle}>{option.label}</Text>
                <Text style={styles.tileHint}>{option.hint}</Text>
                <ChevronRight
                  size={15}
                  color={palette.textMuted}
                  strokeWidth={2}
                  style={styles.tileChevron}
                />
              </PressableScale>
            );
          })}
        </View>

        <Section eyebrow="How it works" title="Three steps">
          <Surface style={styles.step} radius={radii.md}>
            <Text style={styles.stepNumber}>01</Text>
            <Text style={styles.stepText}>
              Post the emergency request with your location.
            </Text>
          </Surface>
          <Surface style={styles.step} radius={radii.md}>
            <Text style={styles.stepNumber}>02</Text>
            <Text style={styles.stepText}>
              Nearby providers send a price and ETA.
            </Text>
          </Surface>
          <Surface style={styles.step} radius={radii.md}>
            <Text style={styles.stepNumber}>03</Text>
            <Text style={styles.stepText}>
              Accept the quote and track the provider to you.
            </Text>
          </Surface>
        </Section>

        <Text style={styles.note}>
          For life-threatening emergencies call local emergency services first.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  spacer: { width: 44 },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
  },
  title: { ...typography.display, color: palette.textPrimary },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 130,
  },
  tileSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileTitle: { ...typography.captionMedium, color: palette.textPrimary },
  tileHint: { ...typography.label, color: palette.textMuted, marginTop: 2 },
  tileChevron: { position: 'absolute', top: spacing.md, right: spacing.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stepNumber: { ...typography.label, color: palette.accent, letterSpacing: 1 },
  stepText: { ...typography.caption, color: palette.textSecondary, flex: 1 },
  note: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
