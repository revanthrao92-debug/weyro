import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer, AppHeader, EmptyState } from '@/components/ui';

const COPY: Record<string, { title: string; subtitle: string; message: string }> = {
  ADMIN: {
    title: 'Overview',
    subtitle: 'Platform at a glance',
    message: 'Verifications, escrow and platform activity will surface here.',
  },
  PROVIDER: {
    title: 'Dashboard',
    subtitle: 'Your workshop at a glance',
    message: 'Nearby requests, jobs and earnings will surface here.',
  },
  CUSTOMER: {
    title: 'Home',
    subtitle: 'Your garage at a glance',
    message: 'Your requests, bookings and vehicles will surface here.',
  },
};

/**
 * Tab landing screen. Content is intentionally an honest placeholder — the
 * dashboard data view is still a backlog item; this only gives the tab the
 * same header chrome as every other screen.
 */
export default function HomeScreen() {
  const { role } = useAuth();
  const copy = COPY[role ?? 'CUSTOMER'] ?? COPY.CUSTOMER;

  return (
    <ScreenContainer>
      <AppHeader title={copy.title} subtitle={copy.subtitle} />
      <EmptyState title="Nothing here yet" message={copy.message} />
    </ScreenContainer>
  );
}
