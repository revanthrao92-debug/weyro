import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type ChatThread = {
  id: string;
  customerId: string;
  providerId: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  provider: {
    id: string;
    businessName: string;
    providerType: string;
    description: string | null;
    serviceRadiusKm: number | null;
    avgRating: number;
    totalReviews: number;
    completedJobs: number;
  } | null;
  request?: { id: string; title: string; status: string } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
};

export function useChatThreads() {
  return useQuery({
    queryKey: ['chatThreads'],
    queryFn: async () => {
      const res = await apiClient<{ items: ChatThread[]; nextCursor?: string | null }>(
        '/chat/threads',
      );
      return res;
    },
  });
}

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  content: string;
  mediaUrls: string[];
  readAt: string | null;
  createdAt: string;
};

export function useChatMessages(threadId: string) {
  return useQuery({
    queryKey: ['chatMessages', threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      const res = await apiClient<{ items: ChatMessage[]; nextCursor?: string | null }>(
        `/chat/threads/${threadId}/messages`,
      );
      return res;
    },
  });
}

export function useSendChatMessage(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) =>
      apiClient<ChatMessage>(`/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
    },
  });
}

export function useMarkThreadRead(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiClient(`/chat/threads/${threadId}/read`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
    },
  });
}
