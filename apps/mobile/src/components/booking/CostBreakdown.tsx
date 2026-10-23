import { View, Text, StyleSheet } from 'react-native';

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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#208AEF',
  },
});
