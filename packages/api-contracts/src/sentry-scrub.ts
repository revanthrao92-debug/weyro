/**
 * M9: PII scrubbing for Sentry events, shared by the API and the mobile app.
 *
 * Phone numbers, OTP codes, passwords and tokens must never leave the device /
 * server inside an error report. Two layers:
 *  1. any object KEY that names sensitive data has its value replaced;
 *  2. any string VALUE is pattern-scrubbed (phone numbers, JWTs, bearer tokens,
 *     bare 6-digit codes that follow "otp"/"code"), because secrets also leak
 *     inside messages, URLs and breadcrumbs.
 */

const FILTERED = '[Filtered]';

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|otp|^code$|verification.?code|start.?code|phone|mobile|msisdn|signature|api[-_]?key|auth[-_]?key|set-cookie|x-razorpay/i;

/** JWT: three base64url segments, the first two starting with eyJ. */
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const BEARER = /(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
/**
 * Phone numbers, as three explicit shapes (a single clever regex missed the very
 * common "+91 98765 43210" grouping):
 *  - international: a "+" then 9-17 digits/separators      (+91 98765 43210, +1 (415) 555-0100)
 *  - Indian national mobile: 10 digits starting 6-9, optional 0/91 prefix and
 *    an optional 5+5 split                                   (9876543210, 09876543210, 98765 43210)
 *  - parenthesised area code                                 ((987) 654-3210)
 */
const PHONE_INTERNATIONAL = /\+\d[\d\s().-]{8,16}\d/g;
const PHONE_INDIAN = /(?<![\w.:/-])(?:0|91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\w.])/g;
const PHONE_PARENS = /\(\d{3}\)\s?\d{3}[\s-]\d{4}/g;
/** "otp 123456", "code: 123456", "otp=123456" */
const LABELLED_CODE = /\b(otp|code|pin)\b(["']?\s*[:=]?\s*["']?)\d{4,8}\b/gi;
const QUERY_SECRET = /([?&](?:token|key|signature|code|otp|phone)=)[^&#\s]+/gi;

export function scrubString(value: string): string {
  return value
    .replace(JWT, '[token]')
    .replace(BEARER, '$1[token]')
    .replace(QUERY_SECRET, '$1[Filtered]')
    .replace(LABELLED_CODE, (_m, label, sep) => `${label}${sep}[code]`)
    .replace(PHONE_INTERNATIONAL, '[phone]')
    .replace(PHONE_PARENS, '[phone]')
    .replace(PHONE_INDIAN, '[phone]');
}

/** Deep-scrub any JSON-like value. Never mutates the input. */
export function scrubValue<T>(input: T, depth = 0): T {
  if (depth > 12) return FILTERED as unknown as T;
  if (typeof input === 'string') return scrubString(input) as unknown as T;
  if (Array.isArray(input)) return input.map((item) => scrubValue(item, depth + 1)) as unknown as T;
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrubValue(value, depth + 1);
    }
    return out as T;
  }
  return input;
}

/**
 * `beforeSend` / `beforeBreadcrumb` helper. Also drops user identity down to an
 * opaque id and removes request bodies / cookies / IP entirely.
 */
export function scrubSentryEvent<T extends Record<string, any>>(event: T): T {
  const scrubbed: Record<string, any> = scrubValue(event);

  if (scrubbed.request) {
    delete scrubbed.request.cookies;
    delete scrubbed.request.data;
    if (scrubbed.request.headers) {
      scrubbed.request.headers = scrubValue(scrubbed.request.headers);
    }
  }
  if (scrubbed.user) {
    scrubbed.user = scrubbed.user.id ? { id: String(scrubbed.user.id) } : undefined;
  }
  return scrubbed as T;
}
