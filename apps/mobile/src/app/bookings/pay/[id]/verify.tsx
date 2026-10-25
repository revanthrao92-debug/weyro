import { ScreenContainer, AppHeader, EmptyState, BackButton } from '@/components/ui';

export default function PaymentVerifyScreen() {
  return (
    <ScreenContainer safeBottom>
      <AppHeader left={<BackButton />} title="Payment Verification" />
      <EmptyState
        title="Payment Verification"
        message="Verify your payment here."
      />
    </ScreenContainer>
  );
}
