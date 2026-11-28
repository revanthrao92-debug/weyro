import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Feedback at the app's key moments. The OS's own haptics setting already
 * lets users turn these off. No-op on web; never throws, so a haptic can't
 * break the flow it decorates.
 */
function run(effect: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  effect().catch(() => undefined);
}

export const haptics = {
  /** Faint tick: finger moving to the next day on a chart. */
  tick: () => run(() => Haptics.selectionAsync()),
  /** Light tap: sending a message. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heavy: SOS. */
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Something went through: quote accepted, job moved forward. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Destructive confirm: cancelling a booking or calling off a job. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
