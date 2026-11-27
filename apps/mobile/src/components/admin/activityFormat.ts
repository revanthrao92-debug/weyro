/** Shared wording for admin activity rows (Overview and the Activity tab). */

const ACTIONS: Record<string, string> = {
  'payment.reconcile': 'Payment checked with the bank',
  'payment.release': 'Payment released to provider',
  'payment.refund': 'Payment refunded',
  'payment.refund_requested': 'Refund requested',
  'payment.refund_failed': 'Refund failed',
  'payment.auto_refund': 'Automatic refund',
  'booking.payment_override': 'Payment rule overridden for a job',
  'provider.verify': 'Provider review decision',
  'provider.documents.submit': 'Provider sent documents',
};

/** "payment.release" -> "Payment released to provider"; unknown codes become plain words. */
export function actionLabel(action: string): string {
  const key = action.toLowerCase();
  if (ACTIONS[key]) return ACTIONS[key];
  const words = action.toLowerCase().split(/[._]/).filter(Boolean);
  if (words.length === 0) return 'Activity';
  return [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
}

/** "10:42" today, otherwise "25 Nov, 10:42" (India date style). */
export function whenShort(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? time : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}
