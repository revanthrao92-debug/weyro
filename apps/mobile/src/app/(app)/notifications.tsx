import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import {
  ScreenContainer,
  PressableScale,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import {
  palette,
  spacing,
  typography,
  displayFamily,
  fontFamilyMono,
} from '@/theme';
import { useNotifications } from '@/hooks/useNotifications';

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    markAllAsRead,
    markAsRead,
    isMarkingAllAsRead,
  } = useNotifications();

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <Text style={styles.eyebrow}>Updates</Text>
              {unreadCount > 0 ? (
                <PressableScale
                  onPress={() => void markAllAsRead()}
                  disabled={isMarkingAllAsRead}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark all as read, ${unreadCount} unread`}
                  scaleTo={0.95}
                >
                  <Text style={styles.markAll}>
                    {isMarkingAllAsRead ? 'Marking…' : 'Mark all read'}
                  </Text>
                </PressableScale>
              ) : null}
            </View>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.summary}>
              {notifications.length === 0
                ? 'No updates yet'
                : `${unreadCount} unread · ${notifications.length} total`}
            </Text>

            {isLoading ? (
              <View>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.rowText}>
                      <Skeleton width="55%" height={14} />
                      <Skeleton width="90%" height={10} style={{ marginTop: 6 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <View style={styles.empty}>
              <EmptyState
                icon={<Bell size={26} color={palette.textMuted} strokeWidth={1.7} />}
                title="You're all caught up"
                message="Quote updates, booking changes and reminders appear here."
              />
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const unread = !item.readAt;
          return (
            <PressableScale
              onPress={() => {
                if (unread) void markAsRead(item.id);
                const href = (item.data as { route?: string } | null)?.route;
                if (typeof href === 'string') router.push(href as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}${unread ? ', unread' : ''}`}
              scaleTo={0.99}
              style={[styles.row, index > 0 && styles.divider]}
            >
              <View style={styles.dotCol}>
                {unread ? <View style={styles.unreadDot} /> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowBody} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>
              <Text style={styles.date}>{dateLabel(item.createdAt)}</Text>
            </PressableScale>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void refetch()}
            tintColor={palette.textSecondary}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { ...typography.label, color: palette.textMuted },
  markAll: { ...typography.label, color: palette.accent },
  title: {
    fontFamily: displayFamily,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  summary: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  dotCol: { width: 10, paddingTop: 5 },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.caption, color: palette.textSecondary },
  rowTitleUnread: { ...typography.captionMedium, color: palette.textPrimary },
  rowBody: { ...typography.label, color: palette.textMuted, marginTop: 2 },
  date: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
  },
  empty: { marginTop: spacing.lg },
});
