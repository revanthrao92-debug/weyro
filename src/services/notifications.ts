import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './api-client';

// Configure how notifications appear when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let isConfigured = false;
let pushToken: string | null = null;

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isConfigured) return pushToken;

  if (Platform.OS === 'web') {
    // Web push is not configured; do not register a fake token.
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  if (!projectId) {
    console.warn(
      '[notifications] EAS projectId is not configured; skipping push registration.',
    );
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    }

    // Retrieve Expo Push Token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      pushToken = tokenData.data;

      // Register token with backend API if valid Expo token
      if (pushToken && pushToken.startsWith('ExponentPushToken[')) {
        apiClient
          .post('/notifications/push-token', {
            token: pushToken,
            deviceOs: Platform.OS,
          })
          .catch(() => {});
      }
    } catch (err) {
      console.warn('[notifications] Failed to obtain Expo push token', err);
      pushToken = null;
    }

    isConfigured = true;
    return pushToken;
  } catch {
    return null;
  }
}

export async function triggerNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Non-blocking catch for restricted simulator environments
  }
}

// Pre-defined Weyro Automotive triggers
export const weyroNotifications = {
  quoteReceived: (providerName: string, part: string, cost: number) => {
    triggerNotification(
      'New Quote Received! 💬',
      `${providerName} submitted a bid of ₹${cost} for your ${part}.`,
      { type: 'QUOTE_RECEIVED' },
    );
  },

  milestoneAdvanced: (trackingNumber: string | undefined, newStatus: string) => {
    const label = newStatus.replace(/_/g, ' ');
    triggerNotification(
      'Logistics Update 🚚',
      `Booking milestone updated to: ${label}.${trackingNumber ? ` Waybill: ${trackingNumber}` : ''}`,
      { type: 'MILESTONE_ADVANCED' },
    );
  },

  chatMessageReceived: (senderName: string, text: string) => {
    triggerNotification(
      `Message from ${senderName}`,
      text,
      { type: 'CHAT_MESSAGE' },
    );
  },
};
