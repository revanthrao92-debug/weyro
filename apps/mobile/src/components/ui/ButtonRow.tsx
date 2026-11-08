import { StyleSheet, View } from 'react-native';
import { ReactNode } from 'react';
import { spacing } from '@/theme';

export interface ButtonRowProps {
  children: ReactNode;
  /** Vertical stack instead of side-by-side. Default false. */
  vertical?: boolean;
}

/** Consistent spacing wrapper for a pair/row of actions. */
export function ButtonRow({ children, vertical = false }: ButtonRowProps) {
  return <View style={[styles.row, vertical && styles.vertical]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  vertical: {
    flexDirection: 'column',
  },
});

export default ButtonRow;
