import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Platform as RNPlatform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function PushTokenScreen() {
  const { user } = useAuth();
  const { registerPushToken, deletePushToken } = useNotifications();

  const handleRegister = async () => {
    try {
      if (RNPlatform.OS === 'web') {
        Alert.alert('Not supported', 'Web push notifications are not configured.');
        return;
      }

      const permission = await Notifications.requestPermissionsAsync();
      if (permission.granted) {
        const expoPushToken = await Notifications.getExpoPushTokenAsync();
        const token = expoPushToken.data;

        // Store token locally
        await SecureStore.setItemAsync('weyro_push_token', token);

        // Register with backend
        const deviceOs = RNPlatform.OS === 'ios' ? 'ios' : 'android';
        await registerPushToken({ token, deviceOs });

        Alert.alert('Success', 'Push notifications enabled');
      } else {
        Alert.alert('Permission denied', 'Please enable notifications in settings.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to register push token');
    }
  };

  const handleDelete = async () => {
    try {
      const stored = await SecureStore.getItemAsync('weyro_push_token');
      if (stored) {
        await deletePushToken(stored);
        await SecureStore.deleteItemAsync('weyro_push_token');
        Alert.alert('Done', 'Push token removed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to remove push token');
    }
  };

  useEffect(() => {
    if (user) {
      void SecureStore.getItemAsync('weyro_push_token');
    }
  }, [user]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 16 }}>
        Push Notifications
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Enable Push Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={handleDelete}>
        <Text style={styles.secondaryButtonText}>Disable Push Notifications</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 16,
  },
} as any;
