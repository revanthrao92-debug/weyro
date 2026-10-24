import { StyleSheet, View } from 'react-native';
import { ReactNode } from 'react';
import { palette, spacing } from '@/theme';

export interface FilterBarProps {
  children: ReactNode;
}

/**
 * Full-bleed band that visually separates filter controls from the list
 * content below: sunken `surfaceAlt` background + hairline top/bottom edges.
 * Wrap a screen's filter row (chips or search inputs) with this.
 *
 * Uses negative horizontal margin to cancel ScreenContainer's padding so the
 * band spans edge to edge, and images the inner padding back.
 */
export function FilterBar({ children }: FilterBarProps) {
  return <View style={styles.bar}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    marginBottom: spacing.md,
  },
});

export default FilterBar;
