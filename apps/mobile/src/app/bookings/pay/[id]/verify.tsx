import { ScreenContainer, AppHeader, EmptyState } from '@/components/ui';

export default function PaymentVerifyScreen() {
  return (
    <ScreenContainer>
      <AppHeader title="Payment Verification" />
      <EmptyState
        title="Payment Verification"
        message="Verify your payment here."
      />
    </ScreenContainer>
  );
}
