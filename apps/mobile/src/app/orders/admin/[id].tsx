import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiClient } from '@/services/api-client';

interface AdminOrderDetail {
  id: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  status: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  customerId: string;
  providerId: string;
  sparePart: { id: string; name: string; partNumber: string; imageUrl?: string | null };
  customer: {
    firstName: string;
    lastName: string;
    user?: { email?: string | null; phone?: string | null };
  };
  provider: {
    businessName: string;
    verificationStatus: string;
    avgRating: number;
    completedJobs: number;
    isAvailable: boolean;
  };
}

const STATUS_TONE: Record<string, 'positive' | 'warning' | 'negative'> = {
  PAID: 'positive',
  PENDING: 'warning',
  CANCELLED: 'negative',
  FAILED: 'negative',
};

const rupees = (amount: number) => `₹${Number(amount).toLocaleString('en-IN')}`;

const stamp = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function AdminOrderDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<AdminOrderDetail>(
        `/spare-parts/orders/${id as string}`,
      );
      setOrder(response);
    } catch (err: any) {
      setError(err?.message || 'Unable to load order details. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrder();
  }, [fetchOrder]);

  const styles = makeStyles(theme);
  const tone = order ? STATUS_TONE[order.status] || 'warning' : 'warning';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}>
        <View style={[styles.content, { maxWidth: MaxContentWidth }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}>
              <ThemedText style={styles.backText}>‹</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              Order Inspection
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error || !order ? (
            <View style={styles.center}>
              <ThemedText style={styles.error} themeColor="danger">
                {error || 'Order not found'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading order"
                onPress={fetchOrder}
                style={styles.retryBtn}>
                <ThemedText style={styles.retryText}>Try Again</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <ThemedText type="smallBold" style={styles.title}>
                {order.sparePart?.name}
              </ThemedText>
              <View style={styles.metaRow}>
                <View style={[styles.chip, styles[`${tone}Chip`]]}>
                  <ThemedText type="small" style={[styles.chipText, styles[`${tone}ChipText`]]}>
                    {order.status}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={styles.metaText}>
                  Order #{order.id.slice(0, 8)}
                </ThemedText>
              </View>

              <View style={styles.block}>
                <Row label="Part" value={order.sparePart?.name || '—'} styles={styles} />
                <Row label="Part Number" value={`#${order.sparePart?.partNumber || '—'}`} styles={styles} />
                <Row label="Quantity" value={String(order.quantity)} styles={styles} />
                <Row label="Unit Price" value={rupees(order.unitPrice)} styles={styles} />
                <Row label="Total" value={rupees(order.totalAmount)} styles={styles} strong />
              </View>

              <ThemedText type="smallBold" style={styles.sectionLabel}>
                PARTIES
              </ThemedText>
              <View style={styles.block}>
                <Row label="Dealer" value={order.provider?.businessName || '—'} styles={styles} />
                <Row
                  label="Customer"
                  value={
                    order.customer
                      ? `${order.customer.firstName} ${order.customer.lastName}`
                      : '—'
                  }
                  styles={styles}
                />
                <Row label="Customer Email" value={order.customer?.user?.email || 'Not on file'} styles={styles} />
                <Row label="Customer Phone" value={order.customer?.user?.phone || 'Not on file'} styles={styles} />
              </View>

              <ThemedText type="smallBold" style={styles.sectionLabel}>
                PAYMENT RECONCILIATION
              </ThemedText>
              <View style={styles.block}>
                <Row label="Gateway Order" value={order.gatewayOrderId || '—'} styles={styles} />
                <Row label="Gateway Payment" value={order.gatewayPaymentId || '—'} styles={styles} />
                <Row label="Paid At" value={stamp(order.paidAt)} styles={styles} />
              </View>

              <ThemedText type="smallBold" style={styles.sectionLabel}>
                TIMELINE
              </ThemedText>
              <View style={styles.block}>
                <Row label="Order Created" value={stamp(order.createdAt)} styles={styles} />
                <Row label="Payment Settled" value={stamp(order.paidAt)} styles={styles} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({
  label,
  value,
  styles,
  strong,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'} style={styles.rowValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const makeStyles = (theme: NonNullable<ReturnType<typeof useTheme>>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.three,
    },
    content: {
      width: '100%',
      alignSelf: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.two,
    },
    backBtn: {
      paddingVertical: Spacing.one,
      paddingRight: Spacing.two,
    },
    backText: {
      fontSize: 18,
      color: theme.primary,
    },
    headerTitle: {
      fontSize: 17,
      color: theme.text,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.six,
    },
    title: {
      fontSize: 20,
      color: theme.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.one,
      marginBottom: Spacing.three,
    },
    metaText: {
      color: theme.textSecondary,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: theme.textSecondary,
      marginTop: Spacing.three,
      marginBottom: Spacing.one,
    },
    block: {
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.two,
      gap: Spacing.one,
      ...Elevation.low,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.two,
    },
    rowLabel: {
      color: theme.textSecondary,
      flexShrink: 0,
    },
    rowValue: {
      color: theme.text,
      flexShrink: 1,
      textAlign: 'right',
    },
    chip: {
      paddingHorizontal: Spacing.one,
      paddingVertical: 2,
      borderRadius: BorderRadius.round,
      alignSelf: 'flex-start',
    },
    chipText: {
      fontSize: 10,
      fontWeight: '700',
    },
    positiveChip: {
      backgroundColor: theme.primarySurface,
    },
    positiveChipText: {
      color: theme.primary,
    },
    warningChip: {
      backgroundColor: theme.warningSurface,
    },
    warningChipText: {
      color: theme.warning,
    },
    negativeChip: {
      backgroundColor: theme.danger,
    },
    negativeChipText: {
      color: theme.inverseText,
    },
    error: {
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    retryBtn: {
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.medium,
      backgroundColor: theme.primarySurface,
    },
    retryText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 13,
    },
  });
