/**
 * C3: uploads are stored as object KEYS (e.g. `damage-requests/<userId>/1700_ab12.jpg`),
 * never as presigned URLs — those expire (S3 caps them at 7 days) and leak
 * credentials into the database. This module centralizes key detection and the
 * legacy "full URL → key" conversion used by the data migration and by clients
 * that still send URLs.
 */

import { BadRequestException } from '@nestjs/common';

/** Top-level folders written by the uploads module (see UPLOAD_FOLDERS). */
export const MEDIA_FOLDERS = [
  'damage-requests',
  'vehicles',
  'avatars',
  'spare-parts',
  'verification-documents',
] as const;

const FOLDER_PATTERN = MEDIA_FOLDERS.join('|');
const KEY_REGEX = new RegExp(`^(?:${FOLDER_PATTERN})/[A-Za-z0-9._\\-/]+$`);
const KEY_IN_PATH_REGEX = new RegExp(`(?:^|/)((?:${FOLDER_PATTERN})/[A-Za-z0-9._\\-/]+)$`);

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** True when the value already looks like one of our storage keys. */
export function isMediaKey(value: string): boolean {
  return KEY_REGEX.test(value) && !value.includes('..') && !value.includes('//');
}

/**
 * Extract the storage key from a stored full URL. Handles:
 *  - virtual-host S3:   https://bucket.s3.region.amazonaws.com/<key>?X-Amz-…
 *  - path-style S3:     https://host/<bucket>/<key>?X-Amz-…
 *  - local dev driver:  https://api/api/v1/uploads/local-file?key=<key>&token=…
 * Returns null for URLs that do not point at our storage (e.g. external CDN
 * images from seed data) so callers can leave them untouched.
 */
export function extractMediaKey(value: string): string | null {
  if (isMediaKey(value)) return value;
  if (!isHttpUrl(value)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const queryKey = url.searchParams.get('key');
  if (queryKey && isMediaKey(queryKey)) return queryKey;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const match = KEY_IN_PATH_REGEX.exec(pathname);
  if (match && isMediaKey(match[1])) return match[1];
  return null;
}

/** Folders each kind of media reference may point into. */
export const MEDIA_FOLDERS_BY_USE = {
  damage: ['damage-requests'],
  part: ['spare-parts'],
  avatar: ['avatars'],
  chat: ['damage-requests', 'spare-parts', 'avatars', 'vehicles'],
} as const satisfies Record<string, readonly (typeof MEDIA_FOLDERS)[number][]>;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface UploadedObjectLookup {
  uploadedObject: {
    findMany(args: {
      where: { key: { in: string[] }; ownerId: string };
      select: { key: true };
    }): Promise<{ key: string }[]>;
  };
}

/**
 * H4: media references are accepted only as KEYS that
 *  1. match `<folder>/<callerUserId>/<file>` for a folder allowed for this use,
 *  2. were finalized (a row in uploaded_objects, i.e. the object exists and
 *     passed the magic-byte check) and are owned by the caller.
 * URLs, other users' keys and un-finalized keys are rejected with 400.
 */
export async function assertOwnedMediaKeys(
  prisma: UploadedObjectLookup,
  userId: string,
  values: readonly string[],
  folders: readonly string[],
): Promise<string[]> {
  if (values.length === 0) return [];
  const pattern = new RegExp(
    `^(?:${folders.join('|')})/${escapeRegExp(userId)}/[A-Za-z0-9._-]+$`,
  );
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value)) {
      throw new BadRequestException(
        'Media must be a key of a file you uploaded (see /uploads/finalize)',
      );
    }
  }
  const unique = [...new Set(values)];
  const finalized = await prisma.uploadedObject.findMany({
    where: { key: { in: unique }, ownerId: userId },
    select: { key: true },
  });
  if (finalized.length !== unique.length) {
    throw new BadRequestException(
      'One or more files were not uploaded or have not been finalized',
    );
  }
  return [...values];
}
