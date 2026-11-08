import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing, radii, typography } from '@/theme';

export type CostBreakdownProps = {
  parts: number;
  labour: number;
  shipping?: number;
  tax?: number;
  total: number;
};

export function CostBreakdown({ parts, labour, shipping = 0, tax = 0, total }: CostBreakdownProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cost Breakdown</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Parts</Text>
        <Text style={styles.value}>₹{parts.toLocaleString()}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Labour</Text>
        <Text style={styles.value}>₹{labour.toLocaleString()}</Text>
      </View>

      {shipping > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Shipping</Text>
          <Text style={styles.value}>₹{shipping.toLocaleString()}</Text>
        </View>
      )}

      {tax > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>GST</Text>
          <Text style={styles.value}>₹{tax.toLocaleString()}</Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>₹{total.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  title: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceAlt,
  },
  label: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  value: {
    ...typography.captionMedium,
    color: palette.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    marginTop: spacing.xs,
  },
  totalLabel: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  totalValue: {
    ...typography.heading,
    color: palette.textPrimary,
  },
});
