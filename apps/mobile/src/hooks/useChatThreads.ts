import { useQuery } from '@tanstack/react-query';
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
