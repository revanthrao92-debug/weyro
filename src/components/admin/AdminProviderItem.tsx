import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ProviderVerificationRecord } from '@weyro/api-contracts';

interface AdminProviderItemProps {
  provider: ProviderVerificationRecord;
  onVerify: () => void;
  onReject: () => void;
}

export function AdminProviderItem({
  provider,
  onVerify,
  onReject,
}: AdminProviderItemProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={styles.info}>
          <ThemedText type="smallBold" style={styles.businessName}>
            {provider.businessName}
          </ThemedText>
          <ThemedText style={styles.address} themeColor="textSecondary">
            {provider.address} • {provider.phone}
          </ThemedText>
          <ThemedText style={styles.taxId} themeColor="textSecondary">
            GSTIN/Tax: {provider.taxId || 'Pending GSTIN'} • Lic: {provider.licenseNumber || 'N/A'}
          </ThemedText>
        </View>
        <View
          accessible
          accessibilityLabel={`Verification status: ${provider.verificationStatus}`}
          style={[
            styles.badge,
            {
              backgroundColor:
                provider.verificationStatus === 'VERIFIED'
                  ? theme.successSurface
                  : provider.verificationStatus === 'REJECTED'
                  ? theme.dangerSurface
                  : theme.warningSurface,
            },
          ]}>
          <ThemedText
            style={[
              styles.badgeText,
              {
                color:
                  provider.verificationStatus === 'VERIFIED'
                    ? theme.success
                    : provider.verificationStatus === 'REJECTED'
                    ? theme.danger
                    : theme.warning,
              },
            ]}>
            {provider.verificationStatus}
          </ThemedText>
        </View>
      </View>

      {provider.verificationStatus === 'PENDING' && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={onReject}
            accessibilityRole="button"
            accessibilityLabel={`Reject verification for ${provider.businessName}`}
            style={[styles.btn, styles.rejectBtn, { backgroundColor: theme.dangerSurface }]}>
            <ThemedText style={[styles.rejectText, { color: theme.danger }]}>Reject</ThemedText>
          </Pressable>
          <Pressable
            onPress={onVerify}
            accessibilityRole="button"
            accessibilityLabel={`Verify ${provider.businessName}`}
            style={[styles.btn, styles.verifyBtn, { backgroundColor: theme.success }]}>
            <ThemedText style={[styles.verifyText, { color: theme.inverseText }]}>Verify Partner</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    marginBottom: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
  },
  businessName: {
    fontSize: 14,
  },
  address: {
    fontSize: 11,
    marginTop: 2,
  },
  taxId: {
    fontSize: 10,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  btn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  rejectBtn: {},
  rejectText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verifyBtn: {},
  verifyText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
