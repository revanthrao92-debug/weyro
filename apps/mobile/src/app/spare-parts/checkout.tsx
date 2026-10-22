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
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiClient } from '@/services/api-client';

interface CreateOrderResponse {
  orderId: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  razorpayOrderId: string;
  keyId: string;
}

interface CheckoutMessage {
  type: 'success' | 'dismissed';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

type Stage = 'creating' | 'paying' | 'verifying' | 'success' | 'failed' | 'cancelled';

const buildCheckoutHtml = (opts: {
  keyId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  currency: string;
  partName: string;
}) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Checkout</title>
<style>body{margin:0;padding:24px;font-family:-apple-system,system-ui,sans-serif;background:#ffffff;color:#1a1a1a;}</style>
</head>
<body>
<div id="status">Starting payment…</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  var rzp = new Razorpay({
    key: '${opts.keyId}',
    order_id: '${opts.razorpayOrderId}',
    amount: ${opts.amountInPaise},
    currency: '${opts.currency}',
    name: 'Weyro Spare Parts',
    description: ${JSON.stringify(opts.partName)},
    image: 'https://weyro.app/favicon.png',
    handler: function (resp) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'success',
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature,
      }));
    },
    modal: {
      ondismiss: function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismissed' }));
      },
    },
  });
  try {
    document.getElementById('status').textContent = 'Tap to complete payment if the sheet does not open.';
    rzp.open();
  } catch (e) {
    document.getElementById('status').textContent = 'Unable to start payment. Please retry.';
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismissed' }));
  }
</script>
</body>
</html>
`;

export default function SparePartsCheckoutScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [stage, setStage] = useState<Stage>('creating');
  const [error, setError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);

  const createOrder = useCallback(async () => {
    if (!id) return;

    setStage('creating');
    setError(null);

    try {
      const response = await apiClient.post<CreateOrderResponse>(
        `/spare-parts/${id}/orders`,
        { quantity: 1 },
      );
      setOrder(response);
      setStage('paying');
    } catch (err: any) {
      setError(err?.message || 'Unable to start checkout. Please try again.');
      setStage('failed');
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void createOrder();
  }, [createOrder]);

  const handleWebviewMessage = async (event: WebViewMessageEvent) => {
    let message: CheckoutMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as CheckoutMessage;
    } catch {
      return;
    }

    if (message.type === 'dismissed') {
      setStage('cancelled');
      return;
    }

    if (message.type !== 'success' || !order) return;

    setStage('verifying');

    try {
      await apiClient.post(`/spare-parts/orders/${order.orderId}/verify`, {
        razorpayOrderId: message.razorpay_order_id,
        razorpayPaymentId: message.razorpay_payment_id,
        razorpaySignature: message.razorpay_signature,
      });
      setStage('success');
    } catch (err: any) {
      setError(
        err?.message ||
          'Payment succeeded but we could not confirm your order. Contact support.',
      );
      setStage('failed');
    }
  };

  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      {(stage === 'creating' || stage === 'verifying') && (
        <View style={styles.centerContainer} accessibilityLabel="Processing">
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={styles.statusText} themeColor="textSecondary">
            {stage === 'creating'
              ? 'Preparing your order…'
              : 'Confirming your payment…'}
          </ThemedText>
        </View>
      )}

      {stage === 'paying' && order && (
        <WebView
          key={webViewKey}
          source={{
            html: buildCheckoutHtml({
              keyId: order.keyId,
              razorpayOrderId: order.razorpayOrderId,
              amountInPaise: Math.round(order.totalAmount * 100),
              currency: order.currency,
              partName: 'Spare part order',
            }),
          }}
          onMessage={handleWebviewMessage}
          originWhitelist={['*']}
          accessibilityLabel="Payment window"
          style={styles.webview}
        />
      )}

      {(stage === 'success' || stage === 'failed' || stage === 'cancelled') && (
        <ScrollView
          contentContainerStyle={[
            styles.centerContainer,
            { paddingBottom: insets.bottom + Spacing.two },
          ]}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="smallBold" style={styles.resultTitle}>
            {stage === 'success'
              ? 'Order Placed 🎉'
              : stage === 'cancelled'
                ? 'Payment Cancelled'
                : 'Something Went Wrong'}
          </ThemedText>
          <ThemedText style={styles.resultText} themeColor="textSecondary">
            {stage === 'success'
              ? `Your spare part order${order ? ` #${order.orderId.slice(0, 8)}` : ''} is confirmed and paid.`
              : stage === 'cancelled'
                ? 'You closed the payment window. Retry when you are ready.'
                : (error || 'Payment could not be completed.')}
          </ThemedText>
          {stage !== 'success' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry payment"
              style={[styles.retryBtn, { backgroundColor: theme.primarySurface }]}
              onPress={() => {
                setWebViewKey((k) => k + 1);
                // Keep the same gateway order; just relaunch checkout
                setStage('paying');
              }}>
              <ThemedText style={[styles.retryText, { color: theme.primary }]}>
                Retry Payment
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to parts"
            style={styles.backBtn}
            onPress={() => router.replace('/spare-parts')}>
            <ThemedText style={styles.backText} themeColor="textSecondary">
              Back to Catalog
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: NonNullable<ReturnType<typeof useTheme>>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
      paddingTop: Spacing.four + Spacing.two,
    },
    statusText: {
      marginTop: Spacing.two,
      fontSize: 14,
      textAlign: 'center',
    },
    webview: {
      flex: 1,
    },
    resultTitle: {
      fontSize: 20,
      color: theme.text,
      marginBottom: Spacing.two,
    },
    resultText: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: Spacing.four,
    },
    retryBtn: {
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.four,
      borderRadius: BorderRadius.medium,
      marginBottom: Spacing.two,
      ...Elevation.low,
    },
    retryText: {
      fontSize: 14,
      fontWeight: '700',
    },
    backBtn: {
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.four,
      borderRadius: BorderRadius.medium,
    },
    backText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
