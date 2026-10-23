import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { useRouter } from 'expo-router';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllAsRead}
          disabled={isMarkingAllAsRead || unreadCount === 0}
        >
          <Text style={styles.markAllButtonText}>
            {isMarkingAllAsRead ? 'Marking...' : 'Mark all as read'}
          </Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptySubtitle}>
            You&apos;re all caught up.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              onPress={() => handleMarkAsRead(item.id)}
              isRead={!!item.readAt}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
        />
      )}
    </View>
  );
}

type NotificationItemProps = {
  item: NonNull<AppNotification>;
  onPress: () => void;
  isRead: boolean;
};

type NonNull<T> = T extends null | undefined ? never : T;

function NotificationItem({ item, onPress, isRead }: NotificationItemProps) {
  return (
    <TouchableOpacity
      style={[styles.item, isRead && styles.itemRead]}
      onPress={onPress}
    >
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, isRead && styles.titleRead]}>
          {item.title}
        </Text>
        <Text style={[styles.body, isRead && styles.bodyRead]}>
          {item.body}
        </Text>
        <Text style={styles.time}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = {
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#208AEF',
    backgroundColor: '#FFFFFF',
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#208AEF',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemRead: {
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  titleRead: {
    color: '#6B7280',
  },
  body: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  bodyRead: {
    color: '#9CA3AF',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#208AEF',
  },
} as any;
