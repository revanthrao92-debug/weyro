import { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useBooking } from '@/hooks/useBookings';
import { usePayments } from '@/hooks/usePayments';
import { CostBreakdown } from '@/components/booking/CostBreakdown';
import { Input, Button, ScreenContainer, AppHeader, Card, SkeletonBlock, EmptyState } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

type PayParams = { id: string };

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<PayParams>();
  const { data: booking, isLoading } = useBooking(id || '');
  const { createOrder, verifyPayment } = usePayments();
  const [order, setOrder] = useState<{ orderId: string; amount: number; currency: string; key?: string } | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [signature, setSignature] = useState('');

  if (isLoading) {
    return (
      <ScreenContainer padded={false}>
        <AppHeader title="Payment" />
        <Card style={styles.skeletonCard}>
          <SkeletonBlock lines={3} />
        </Card>
      </ScreenContainer>
    );
  }

  if (!booking) {
    return (
      <ScreenContainer padded={false}>
        <AppHeader title="Payment" />
        <EmptyState title="Booking not found" message="This booking may have been removed." />
      </ScreenContainer>
    );
  }

  const amount = booking.payment?.amount ?? 0;

  const handleCreateOrder = async () => {
    setPayLoading(true);
    try {
      const res = await createOrder.mutateAsync({
        bookingId: booking.id,
        amount,
        currency: 'INR',
        method: 'UPI',
      });
      setOrder({
        orderId: res.orderId,
        amount: res.amount,
        currency: res.currency,
        key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
      });
    } catch (e: any) {
      Alert.alert('Order creation failed', e.message || 'Unable to create order');
    } finally {
      setPayLoading(false);
    }
  };

  const handlePay = () => {
    if (!order) return;
    Alert.alert(
      'Razorpay Checkout',
      `Order ID: ${order.orderId}\nAmount: ₹${order.amount}\n\nIn production, this opens the Razorpay checkout SDK.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy Order ID', onPress: () => {} },
      ]
    );
  };

  const handleVerify = async () => {
    if (!paymentId || !signature) {
      Alert.alert('Error', 'Please enter payment ID and signature');
      return;
    }
    try {
      await verifyPayment.mutateAsync({
        orderId: order!.orderId,
        paymentId,
        signature,
      });
      Alert.alert('Success', 'Payment verified successfully');
    } catch (e: any) {
      Alert.alert('Verification failed', e.message || 'Payment verification failed');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScreenContainer padded={false}>
        <AppHeader title="Payment" />
        <ScrollView contentContainerStyle={styles.body}>
          <Card>
            <CostBreakdown parts={amount} labour={0} total={amount} />

            {order ? (
              <View style={styles.orderSection}>
                <Text style={styles.label}>Razorpay Order Created</Text>
                <Text style={styles.orderId}>{order.orderId}</Text>
                <Button
                  title="Open Razorpay Checkout"
                  onPress={handlePay}
                  variant="secondary"
                  style={styles.checkoutBtn}
                />
              </View>
            ) : (
              <Button
                title="Create Payment Order"
                onPress={handleCreateOrder}
                disabled={payLoading}
                loading={payLoading}
              />
            )}

            <View style={styles.verifySection}>
              <Text style={styles.label}>Verify Payment (Dev Mode)</Text>
              <Input
                label="Razorpay Payment ID"
                placeholder="Payment ID"
                value={paymentId}
                onChangeText={setPaymentId}
                autoCompleteType="off"
              />
              <Input
                label="Signature"
                placeholder="Signature"
                value={signature}
                onChangeText={setSignature}
                autoCompleteType="off"
              />
              <Button title="Verify Payment" onPress={handleVerify} variant="secondary" />
            </View>
          </Card>
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonCard: { marginBottom: spacing.md },
  orderSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceAlt,
  },
  verifySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceAlt,
  },
  label: { ...typography.captionMedium, color: palette.textSecondary },
  orderId: { ...typography.captionMedium, color: palette.textPrimary, fontFamily: 'monospace', marginBottom: spacing.md },
  checkoutBtn: { alignSelf: 'flex-start' },
});
