/**
 * Rate-limit identity for one request.
 *
 * Authenticated calls are limited per account, not per IP, so users sharing
 * an office/mobile-carrier NAT do not exhaust each other's quota. Public
 * routes (login, webhooks, health) still fall back to the client IP.
 */
export function requestThrottleTracker(request: {
  user?: { sub?: string };
  ip?: string;
}): string {
  const subject = request?.user?.sub;
  if (typeof subject === 'string' && subject.length > 0) {
    return `user:${subject}`;
  }
  return `ip:${request?.ip || 'unknown'}`;
}
