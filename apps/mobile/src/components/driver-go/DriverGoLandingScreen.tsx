import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Car,
  ShieldCheck,
  Wallet,
} from 'lucide-react-native';
import {
  BackButton,
  Button,
  PressableScale,
  ScreenContainer,
  SectionHead,
} from '@/components/ui';
import {
  displayFamily,
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

function Feature({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>{icon}</View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function DriverGoLandingScreen() {
  const router = useRouter();

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.eyebrow}>DRIVER GO</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mark}>
          <Car size={20} color={palette.accent} strokeWidth={1.8} />
        </View>
        <Text style={styles.title}>Your car.{'\n'}A professional driver.</Text>
        <Text style={styles.subtitle}>
          Hire a verified driver for your own vehicle. Hourly, daily or
          scheduled — keep your car, skip the driving.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Book a driver"
            onPress={() => router.push('/driver-go/book')}
          />
          <Button
            title="My driver bookings"
            variant="secondary"
            onPress={() => router.push('/driver-go/bookings')}
          />
        </View>

        <SectionHead index="01" title="How it works" />
        <Feature
          icon={<CalendarClock size={17} color={palette.textPrimary} strokeWidth={1.7} />}
          title="Pick your time"
          detail="Book by the hour, by the day, or for a future slot."
        />
        <Feature
          icon={<BadgeCheck size={17} color={palette.textPrimary} strokeWidth={1.7} />}
          title="Compare verified drivers"
          detail="Experience, ratings, languages and transparent pricing."
        />
        <Feature
          icon={<ShieldCheck size={17} color={palette.textPrimary} strokeWidth={1.7} />}
          title="Start with a code"
          detail="The driver enters your 4-digit code before the trip begins."
        />
        <Feature
          icon={<Wallet size={17} color={palette.textPrimary} strokeWidth={1.7} />}
          title="Clear fare"
          detail="The price is shown before you confirm. No meter surprises."
        />

        <View style={styles.pilotNote}>
          <Text style={styles.pilotTitle}>Hyderabad pilot</Text>
          <Text style={styles.pilotBody}>
            Payment is arranged separately during the pilot. Your booking is
            confirmed with the driver in the app.
          </Text>
        </View>

        <PressableScale
          onPress={() =>
            void Linking.openURL(
              'mailto:support@weyro.app?subject=Drive%20with%20Weyro',
            )
          }
          accessibilityRole="link"
          accessibilityLabel="Drive with Weyro"
          scaleTo={0.98}
          style={styles.recruit}
        >
          <View style={styles.recruitText}>
            <Text style={styles.recruitTitle}>Drive with Weyro</Text>
            <Text style={styles.recruitBody}>
              Professional driver? Join the pilot.
            </Text>
          </View>
          <ArrowRight size={16} color={palette.accent} strokeWidth={2} />
        </PressableScale>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
  },
  spacer: { width: 44 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoftBg,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.8,
    color: palette.textPrimary,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  featureText: { flex: 1 },
  featureTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  featureDetail: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  pilotNote: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pilotTitle: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.accent,
    letterSpacing: 0.8,
  },
  pilotBody: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  recruit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  recruitText: { flex: 1 },
  recruitTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  recruitBody: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
});
