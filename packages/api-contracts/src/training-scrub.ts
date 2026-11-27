import { scrubString } from './sentry-scrub';

/**
 * Clean text people typed (request descriptions, quote notes, completion notes, reviews)
 * before it goes into the AI-training event history. Removes what identifies a person;
 * keeps the problem and the fix in their own words. Names inside free text can't be
 * removed reliably, which docs/DATA.md says plainly.
 */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** UPI IDs: "ravi.k@okaxis", "9876543210@ybl" (run after emails, which have a dot after the @). */
const UPI = /\b[\w.-]{2,}@[a-z]{2,}\b/gi;
/** Indian state and UT codes: the first two letters of every number plate. */
const STATE = '(?:AN|AP|AR|AS|BR|CG|CH|DD|DL|DN|GA|GJ|HP|HR|JH|JK|KA|KL|LA|LD|MH|ML|MN|MP|MZ|NL|OD|OR|PB|PY|RJ|SK|TN|TR|TS|UK|UP|WB)';
/**
 * Indian vehicle numbers: KA01MJ4021, KA 01 MJ 4021, KA-01-AB-1234, MH12A1234, DL 01 1234 (no series),
 * and BH series 22BH1234AA. Real state codes only, so "service at 10000 km" is left alone.
 */
const VEHICLE = new RegExp(
  `\\b(?:${STATE}[\\s-]?\\d{1,2}[\\s-]?[A-Z]{1,3}[\\s-]?\\d{4}|${STATE}[\\s-]?\\d{2}[\\s-]?\\d{4}|\\d{2}[\\s-]?BH[\\s-]?\\d{4}[\\s-]?[A-Z]{1,2})\\b`,
  'gi',
);
/**
 * Address lines the app writes into request descriptions ("Pickup: …", "Destination: …",
 * "Delivery address: …", see serviceRequestConfig.ts), plus the same labels typed by people.
 * Everything after the label up to the end of that line is an address.
 */
const LABELLED_ADDRESS = /\b(delivery address|pickup(?: point| location)?|destination|drop-?off|address|deliver to)\s*:[^\n]*/gi;
/** Aadhaar: 12 digits, often 4-4-4. */
const AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
/** PAN: ABCDE1234F. */
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;

/**
 * Bump whenever the cleaning rules change. The nightly dataset task then re-cleans all stored
 * text, replaces older copies and rewrites the affected day files (apps/api tasks/dataset.service.ts).
 */
export const TRAINING_TEXT_CLEANER_VERSION = 2;

export function scrubTrainingText(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  // Order matters: emails, then UPI IDs (which can contain a phone number), then phone numbers
  // (scrubString), and only then 12-digit Aadhaar, PAN and vehicle numbers, so "+919876543210"
  // is removed as a phone number rather than half-matched as an Aadhaar number.
  const cleaned = scrubString(
    text
      .replace(LABELLED_ADDRESS, (_m, label: string) => `${label}: [address]`)
      .replace(EMAIL, '[email]')
      .replace(UPI, '[upi]'),
  )
    .replace(AADHAAR, '[id-number]')
    .replace(PAN, '[id-number]')
    .replace(VEHICLE, '[vehicle-number]')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}
