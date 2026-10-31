import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell } from 'lucide-react-native';
import {
  ListItem,
  Badge,
  ScreenContainer,
  AppHeader,
  EmptyState,
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
    } catch {
      // Silent — item will be refreshed on next query
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer chrome="dark">
        <AppHeader title="Notifications" />
        {[0, 1, 2, 3].map((i) => (
          <ListItem key={i} title="Notification title" subtitle="Notification body will appear here" />
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer chrome="dark">
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
          icon={<Bell size={28} color={palette.textMuted} />}
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
            <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />
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
