import { ScreenContainer, AppHeader, EmptyState } from '@/components/ui';

export default function EscrowScreen() {
  return (
    <ScreenContainer chrome="dark">
      <AppHeader title="Escrow Ledger" />
      <EmptyState title="Escrow Ledger" message="Payment escrow details will appear here." />
    </ScreenContainer>
  );
}
