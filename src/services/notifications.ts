import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
    return 'web_simulated_token';
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

    // Try to get Expo Push Token (graceful fallback in dev/simulator without project ID)
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      pushToken = tokenData.data;
    } catch {
      pushToken = `local_sim_${Date.now()}`;
    }

    isConfigured = true;
    return pushToken;
  } catch {
    return null;
  }
}

export async function triggerNotification(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // deliver immediately
    });
  } catch {
    // Non-blocking catch in environments where native notification scheduler is restricted
  }
}

// Pre-defined Weyro Automotive triggers
export const weyroNotifications = {
  quoteReceived: (providerName: string, part: string, cost: number) => {
    triggerNotification(
      'New Quote Received! 💬',
      `${providerName} submitted a bid of $${cost} for your ${part}.`,
      { type: 'QUOTE_RECEIVED' }
    );
  },

  milestoneAdvanced: (trackingNumber: string | undefined, newStatus: string) => {
    const label = newStatus.replace(/_/g, ' ');
    triggerNotification(
      'Logistics Update 🚚',
      `Booking milestone updated to: ${label}.${trackingNumber ? ` Waybill: ${trackingNumber}` : ''}`,
      { type: 'MILESTONE_ADVANCED' }
    );
  },

  chatMessageReceived: (senderName: string, text: string) => {
    triggerNotification(
      `Message from ${senderName}`,
      text,
      { type: 'CHAT_MESSAGE' }
    );
  },
};
