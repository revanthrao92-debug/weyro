import {
  View,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Platform as RNPlatform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Button, ScreenContainer, AppHeader, ButtonRow, Card, ListItem, BackButton } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

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

        await SecureStore.setItemAsync('weyro_push_token', token);

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
    <ScreenContainer>
      <AppHeader left={<BackButton />} title="Push Notifications" subtitle="Manage device notifications" />
      <Card style={styles.card}>
        <ListItem
          title="Push Notifications"
          subtitle="Receive updates about your bookings and quotes"
          right={
            <Button title="Enable" variant="secondary" onPress={handleRegister} style={styles.enableBtn} />
          }
        />
      </Card>
      <ButtonRow vertical>
        <Button title="Disable Push Notifications" variant="secondary" onPress={handleDelete} />
      </ButtonRow>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  enableBtn: { minWidth: 88 },
});
