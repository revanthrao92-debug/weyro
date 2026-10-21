import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EscrowLedgerEntry } from '@weyro/api-contracts';

interface AdminEscrowLedgerProps {
  entries: EscrowLedgerEntry[];
}

export function AdminEscrowLedger({ entries }: AdminEscrowLedgerProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.title}>
        ESCROW & PAYMENT LEDGER (INR)
      </ThemedText>

      {entries.length === 0 ? (
        <ThemedText style={styles.emptyText} themeColor="textSecondary">
          No ledger transactions recorded yet.
        </ThemedText>
      ) : (
        entries.map((entry) => (
          <View
            key={entry.bookingId}
            style={[styles.entryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.entryInfo}>
              <ThemedText type="smallBold" style={styles.customerName}>
                {entry.customerName} ➔ {entry.providerName}
              </ThemedText>
              <ThemedText style={styles.bookingId} themeColor="textSecondary">
                Booking #{entry.bookingId.slice(0, 8)} • {new Date(entry.confirmedAt).toLocaleDateString()}
              </ThemedText>
            </View>

            <View style={styles.amountInfo}>
              <ThemedText style={[styles.amountText, { color: theme.primary }]}>
                ₹{entry.amount.toLocaleString('en-IN')}
              </ThemedText>
              <ThemedText
                style={[
                  styles.statusText,
                  {
                    color:
                      entry.status === 'RELEASED_TO_PROVIDER'
                        ? theme.success
                        : entry.status === 'REFUNDED_TO_CUSTOMER'
                        ? theme.danger
                        : theme.info,
                  },
                ]}>
                {entry.status.replace(/_/g, ' ')}
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.three,
  },
  title: {
    letterSpacing: 1.1,
    marginBottom: Spacing.two,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  entryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.two,
    marginBottom: Spacing.one,
  },
  entryInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 13,
  },
  bookingId: {
    fontSize: 11,
    marginTop: 2,
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
