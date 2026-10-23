import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBooking } from '@/hooks/useBookings';
import { usePayments } from '@/hooks/usePayments';
import { Input } from '@/components/ui/Input';
import { CostBreakdown } from '@/components/booking/CostBreakdown';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text>Booking not found</Text>
      </View>
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
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
          Payment
        </Text>
        <Text style={{ fontSize: 16, color: '#6B7280', marginBottom: 20 }}>
          Booking #{booking.id.slice(0, 8)}
        </Text>

        <View style={styles.card}>
          <CostBreakdown parts={amount} labour={0} total={amount} />

          {order ? (
            <View style={styles.orderSection}>
              <Text style={styles.label}>Razorpay Order Created</Text>
              <Text style={styles.orderId}>{order.orderId}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePay}>
                <Text style={styles.buttonText}>Open Razorpay Checkout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateOrder} disabled={payLoading}>
              {payLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>Create Payment Order</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.verifySection}>
            <Text style={styles.label}>Verify Payment (Dev Mode)</Text>
            <Input
              style={styles.input}
              placeholder="Razorpay Payment ID"
              value={paymentId}
              onChangeText={setPaymentId}
              autoCompleteType="off"
            />
            <Input
              style={styles.input}
              placeholder="Signature"
              value={signature}
              onChangeText={setSignature}
              autoCompleteType="off"
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={handleVerify}>
              <Text style={styles.buttonText}>Verify Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  orderSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  verifySection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
} as any;
