import { Pressable, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { palette } from '@/theme';

export interface BackButtonProps {
  /** Accessibility label. Defaults to "Go back". */
  label?: string;
}

/**
 * Chevron back affordance for pushed (non-tab) screens. Screens run without a
 * navigator header (root stack headerShown:false), so this is the visible
 * counterpart to the iOS swipe / Android hardware back gesture.
 */
export function BackButton({ label = 'Go back' }: BackButtonProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      className="active:opacity-60"
      style={styles.button}
    >
      <ChevronLeft size={24} color={palette.textPrimary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
});

export default BackButton;
