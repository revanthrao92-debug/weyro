import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import {
  ScreenContainer,
  BackButton,
  PressableScale,
  Section,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

const FAQS = [
  {
    q: 'How do quotes work?',
    a: 'Post a request with photos and your location. Verified providers nearby send a price, warranty and ETA. You choose the quote that fits.',
  },
  {
    q: 'When am I charged?',
    a: 'You pay after accepting a quote. Payments are held in escrow and released to the provider when the work is marked complete.',
  },
  {
    q: 'Can I cancel a request?',
    a: 'Yes — open the request and tap Cancel request while it is still open or receiving quotes. Accepted bookings are handled from the booking screen.',
  },
  {
    q: 'How do I add or edit a vehicle?',
    a: 'Go to My Vehicles from your profile or the home garage card. Add the make, model, year and registration so providers quote accurately.',
  },
  {
    q: 'Is my payment protected?',
    a: 'Payments are captured by the gateway and settled through Weyro escrow. Providers receive funds only after completion.',
  },
];

const LINKS = [
  { label: 'My bookings', route: '/bookings' },
  { label: 'My requests', route: '/requests/my' },
  { label: 'My vehicles', route: '/vehicles' },
  { label: 'Messages', route: '/messages' },
];

export default function HelpScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.eyebrow}>Support</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={styles.title}>Help &amp; support</Text>
        <Text style={styles.subtitle}>
          Quick answers, and shortcuts to everything you have booked.
        </Text>

        <Section eyebrow="Shortcuts" title="Your activity">
          <View style={styles.links}>
            {LINKS.map((link) => (
              <PressableScale
                key={link.route}
                onPress={() => router.push(link.route)}
                accessibilityRole="button"
                accessibilityLabel={link.label}
                scaleTo={0.98}
                style={styles.linkRow}
              >
                <Text style={styles.linkLabel}>{link.label}</Text>
                <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
              </PressableScale>
            ))}
          </View>
        </Section>

        <Section eyebrow="FAQ" title="Common questions">
          {FAQS.map((faq, index) => {
            const expanded = open === index;
            return (
              <View key={faq.q} style={styles.faq}>
                <PressableScale
                  onPress={() => setOpen(expanded ? null : index)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={faq.q}
                  scaleTo={0.99}
                  style={styles.faqHead}
                >
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <ChevronDown
                    size={16}
                    color={expanded ? palette.accent : palette.textMuted}
                    strokeWidth={2}
                    style={expanded ? styles.chevronOpen : undefined}
                  />
                </PressableScale>
                {expanded ? <Text style={styles.faqAnswer}>{faq.a}</Text> : null}
              </View>
            );
          })}
        </Section>

        <Text style={styles.note}>
          Still stuck? Message your provider from the booking screen, or email
          support@weyro.app.
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
  eyebrow: { ...typography.label, color: palette.accent, letterSpacing: 2 },
  title: { ...typography.display, color: palette.textPrimary },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  links: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  linkLabel: { ...typography.body, color: palette.textPrimary },
  faq: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    paddingVertical: spacing.sm,
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  faqQuestion: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  faqAnswer: {
    ...typography.caption,
    color: palette.textSecondary,
    paddingBottom: spacing.sm,
  },
  note: {
    ...typography.label,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
