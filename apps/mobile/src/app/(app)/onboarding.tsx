import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ScreenContainer, AppHeader, Button } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const ONBOARDING_PAGES = [
  {
    image:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    title: 'Premium Parts.',
    body: 'Genuine and aftermarket parts from verified dealers, all in one place.',
  },
  {
    image:
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80',
    title: 'Trusted Service.',
    body: 'Quotes from verified mechanics and garages near you.',
  },
  {
    image:
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd5?auto=format&fit=crop&w=1200&q=80',
    title: 'Track Every Request.',
    body: 'Live status, provider chat, and escrow protection built in.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const handleSkip = () => router.replace('/(app)');
  const handleNext = () => {
    if (index < ONBOARDING_PAGES.length - 1) {
      setIndex((i) => i + 1);
    } else {
      router.replace('/(app)');
    }
  };
  const last = index === ONBOARDING_PAGES.length - 1;

  return (
    <ScreenContainer style={styles.container}>
      <Image
        source={{ uri: ONBOARDING_PAGES[index].image }}
        style={styles.heroImage}
        contentFit="cover"
      />
      <View style={styles.content}>
        <View style={styles.dots}>
          {ONBOARDING_PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index && { backgroundColor: palette.accent },
              ]}
            />
          ))}
        </View>
        <Text style={styles.title}>{ONBOARDING_PAGES[index].title}</Text>
        <Text style={styles.body}>{ONBOARDING_PAGES[index].body}</Text>
      </View>
      <View style={styles.footer}>
        {last ? (
          <Button
            title="Get Started"
            onPress={handleSkip}
            style={styles.primaryButton}
          />
        ) : (
          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
        {!last ? (
          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.nextButton}
          >
            <Text style={styles.nextText}>Next</Text>
            <ChevronRight size={20} color={palette.onAccent} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  heroImage: {
    width: '100%',
    height: '40%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  title: {
    ...typography.heading,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    flex: 1,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...typography.bodyMedium,
    color: palette.textMuted,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radii.md,
  },
  nextText: {
    ...typography.bodyMedium,
    color: palette.onAccent,
    fontWeight: '600',
  },
});
