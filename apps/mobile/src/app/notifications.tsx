import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { useRouter } from 'expo-router';
import {
  ListItem,
  Badge,
  ScreenContainer,
  AppHeader,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

export default function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    markAllAsRead,
    markAsRead,
    isMarkingAllAsRead,
  } = useNotifications();
  const router = useRouter();

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      Alert.alert('Done', 'All notifications marked as read');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unable to mark all as read');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (e: any) {
      // Silent — item will be refreshed on next query
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader title="Notifications" />
        {[0, 1, 2, 3].map((i) => (
          <ListItem key={i} title="Notification title" subtitle="Notification body will appear here" />
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title="Notifications" subtitle="Your updates" />

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllAsRead}
          disabled={isMarkingAllAsRead || unreadCount === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: isMarkingAllAsRead || unreadCount === 0 }}
          accessibilityLabel={`Mark all as read, ${unreadCount} unread`}
        >
          <Text style={styles.markAllButtonText}>
            {isMarkingAllAsRead ? 'Marking...' : 'Mark all as read'}
          </Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          message="You&apos;re all caught up."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListItem
              title={item.title}
              subtitle={item.body}
              right={
                <View style={styles.meta}>
                  <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  {!item.readAt && <Badge value="New" tone="neutral" />}
                </View>
              }
              onPress={() => handleMarkAsRead(item.id)}
              accessibilityLabel={`Notification ${item.title}`}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerActions: { marginBottom: spacing.md },
  markAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
  },
  markAllButtonText: { ...typography.label, color: palette.textPrimary },
  list: { paddingBottom: spacing.xxl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { ...typography.label, color: palette.textMuted },
});
