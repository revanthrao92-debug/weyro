import { View, Text, StyleSheet } from 'react-native';
import { UserRound, MessageSquare } from 'lucide-react-native';
import { ScreenContainer, AppHeader, EmptyState } from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';
import { PorscheSketch911 } from '@/components/art/PorscheSketch911';

/**
 * Provider discovery — placeholder route.
 *
 * The backend does not expose a public "list providers" endpoint (dealers
 * surface through request quotations instead), so this screen is an honest
 * "coming soon" rather than a fake dealer grid. The Home quick-action
 * routes here so the button is never dead.
 */
export default function ProviderSearchScreen() {
  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Find Dealers" subtitle="Verified partners across the Weyro network" />

      <View style={styles.panel}>
        <EmptyState
          icon={<UserRound size={28} color={palette.textMuted} />}
          title="Dealer discovery is on the way"
          message="Verified dealers and mechanics appear here automatically when you place a request — quotes bring the right partners to you."
          action={
            <View style={styles.noteBox}>
              <MessageSquare size={16} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={styles.noteText}>
                Post a requirement and dealers will respond with quotes — that is
                the fastest way to reach the right partner today.
              </Text>
            </View>
          }
        />
        <View style={styles.sketch} pointerEvents="none">
          <PorscheSketch911 opacity={0.12} strokeWidth={3} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, justifyContent: 'center' },
  sketch: { height: 90, alignItems: 'center' },
  noteBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  noteText: {
    ...typography.caption,
    color: palette.textSecondary,
    flexShrink: 1,
  },
});
