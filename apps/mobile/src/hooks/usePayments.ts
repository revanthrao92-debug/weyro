import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { Alert } from 'react-native';

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  method: string;
  paidAt?: string;
  createdAt: string;
};

export type CreateOrderResult = {
  orderId: string;
  amount: number;
  currency: string;
  key: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
};

export function usePayments() {
  const queryClient = useQueryClient();

  const createOrder = useMutation({
    mutationFn: async ({
      bookingId,
      amount,
      currency = 'INR',
      method = 'UPI',
    }: {
      bookingId: string;
      amount: number;
      currency?: string;
      method?: string;
    }) => {
      return apiClient<CreateOrderResult>('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ bookingId, amount, currency, method }),
      });
    },
  });

  const verifyPayment = useMutation({
    mutationFn: async ({
      orderId,
      paymentId,
      signature,
    }: {
      orderId: string;
      paymentId: string;
      signature: string;
    }) => {
      return apiClient<{ orderId: string; status: string }>(
        '/payments/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
          }),
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const releasePayment = useMutation({
    mutationFn: async ({
      bookingId,
      payoutReference,
      notes,
    }: {
      bookingId: string;
      payoutReference: string;
      notes?: string;
    }) => {
      return apiClient<{ orderId: string; status: string }>(
        '/payments/release',
        {
          method: 'POST',
          body: JSON.stringify({ bookingId, payoutReference, notes }),
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  return { createOrder, verifyPayment, releasePayment };
}
