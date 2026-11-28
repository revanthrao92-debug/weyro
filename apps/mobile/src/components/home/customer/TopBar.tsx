import { Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { PressableScale } from '@/components/ui';
import { palette } from '@/theme';

import type { useRouter } from 'expo-router';
import type { useAuth } from '@/hooks/useAuth';
import { styles } from './styles';

export function TopBar({ router, user, unreadCount, initial }: {
  router: ReturnType<typeof useRouter>;
  user: ReturnType<typeof useAuth>['user'];
  unreadCount: number;
  /** Avatar letter; defaults to the customer's first name. */
  initial?: string;
}) {
  return (
    <>
      {/* Chrome */}
      <View style={styles.topBar}>
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>weyro</Text>
          <View style={styles.mark} />
        </View>
        <View style={styles.topActions}>
          <PressableScale
            onPress={() => router.push('/alerts')}
            accessibilityRole="button"
            accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            scaleTo={0.9}
            style={styles.iconButton}
          >
            <Bell size={20} color={palette.textSecondary} strokeWidth={1.8} />
            {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
          </PressableScale>
          <PressableScale
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            scaleTo={0.92}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {(initial || user?.customerProfile?.firstName?.[0] || 'W').toUpperCase()}
            </Text>
          </PressableScale>
        </View>
      </View>
    </>
  );
}
