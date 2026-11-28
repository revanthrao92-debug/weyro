/**
 * Weyro reference numbers: `<type>-<YYMMDD>-<count>-<check>`, e.g. `J-261127-0042-6`.
 *
 * - type: what it is (see REF_TYPES)
 * - YYMMDD: creation date in India time
 * - count: running number for that type on that day, at least 4 digits (grows past 9999)
 * - check: Damm check digit over the type's digit, the date and the count. It catches every
 *   single wrong digit and every swap of two neighbouring digits.
 *
 * The database assigns these (trigger + ref_counters table, migration 20261127000000_reference_numbers);
 * the SQL function weyro_damm() uses the same table and type digits as this file. Keep them identical.
 */

export const REF_TYPES = {
  R: { digit: 1, label: 'Request' },
  Q: { digit: 2, label: 'Quote' },
  J: { digit: 3, label: 'Job' },
  O: { digit: 4, label: 'Parts order' },
  T: { digit: 5, label: 'Driver trip' },
  P: { digit: 6, label: 'Payment' },
  F: { digit: 7, label: 'Refund' },
} as const;

export type RefType = keyof typeof REF_TYPES;

// Damm's order-10 weakly totally anti-symmetric quasigroup.
const DAMM = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

/** Damm check digit for a string of digits. */
export function dammDigit(digits: string): number {
  let interim = 0;
  for (const ch of digits) interim = DAMM[interim][ch.charCodeAt(0) - 48];
  return interim;
}

/** Build a reference number. `day` is YYMMDD (India date); `count` starts at 1. */
export function formatRef(type: RefType, day: string, count: number): string {
  const padded = String(count).padStart(4, '0');
  const check = dammDigit(`${REF_TYPES[type].digit}${day}${padded}`);
  return `${type}-${day}-${padded}-${check}`;
}

export type ParsedRef = { type: RefType; label: string; day: string; count: number; ref: string };

const REF_PATTERN = /^([RQJOTPF])-?(\d{6})-?(\d{4,})-?(\d)$/;

/**
 * Check a reference someone typed or read out. Accepts lower case, spaces and missing dashes
 * ("j 261127 0042 6"). Returns null when the format or the check digit is wrong.
 */
export function parseRef(text: string): ParsedRef | null {
  const cleaned = text.trim().toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  const match = REF_PATTERN.exec(cleaned);
  if (!match) return null;
  const [, type, day, count, check] = match as unknown as [string, RefType, string, string, string];
  const month = Number(day.slice(2, 4));
  const date = Number(day.slice(4, 6));
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  if (dammDigit(`${REF_TYPES[type].digit}${day}${count}${check}`) !== 0) return null;
  return { type, label: REF_TYPES[type].label, day, count: Number(count), ref: `${type}-${day}-${count}-${check}` };
}
