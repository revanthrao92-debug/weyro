import { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette, spacing, radii, typography, elevation } from '@/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Allow content to scroll when it exceeds the sheet height. Default true. */
  scrollable?: boolean;
}

/**
 * Themed bottom sheet using the built-in Modal (no new dependency). Scrim +
 * rounded top corners + optional title. Content and open/close behavior are
 * controlled by the call site.
 */
export function BottomSheet({ visible, onClose, title, children, scrollable = true }: BottomSheetProps) {
  const Body = scrollable ? ScrollView : View;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title} maxFontSizeMultiplier={2}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
        ) : null}
        <Body
          {...(scrollable
            ? { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false }
            : { style: styles.content })}
        >
          {children}
        </Body>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: palette.overlay,
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
    ...elevation.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.borderStrong,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    color: palette.textPrimary,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  content: {
    paddingBottom: spacing.lg,
  },
});

export default BottomSheet;
