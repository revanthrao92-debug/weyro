import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { Alert } from 'react-native';

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient<{
        items: AppNotification[];
        nextCursor?: string | null;
      }>('/notifications');
      return res;
    },
  });

  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const res = await apiClient<{ unreadCount: number }>(
        '/notifications/unread-count'
      );
      return res;
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      return apiClient<{ updated: number }>('/notifications/read-all', {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/notifications/${id}/read`, {
        method: 'PATCH',
      });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] });
    },
  });

  const registerPushToken = useMutation({
    mutationFn: async ({ token, deviceOs }: { token: string; deviceOs?: 'ios' | 'android' | 'web' }) => {
      return apiClient('/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ token, deviceOs }),
      });
    },
  });

  const deletePushToken = useMutation({
    mutationFn: async (token: string) => {
      return apiClient('/notifications/push-token', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      });
    },
  });

  const notifications = data?.items ?? [];
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;

  return {
    notifications,
    unreadCount,
    isLoading: isLoading || unreadCountQuery.isLoading,
    refetch,
    markAllAsRead: markAllAsRead.mutateAsync,
    markAsRead: markAsRead.mutateAsync,
    registerPushToken: registerPushToken.mutateAsync,
    deletePushToken: deletePushToken.mutateAsync,
    isMarkingAllAsRead: markAllAsRead.isPending,
  };
}

export function useChatUnreadCount() {
  return useQuery({
    queryKey: ['chat', 'unreadCount'],
    queryFn: async () => {
      const res = await apiClient<{ unreadCount: number }>('/chat/unread-count');
      return res;
    },
    refetchInterval: 30_000,
  });
}
