/**
 * Opaque cursor pagination using (createdAt, id) tuples.
 *
 * Instead of exposing raw database IDs as cursors (which can skip rows on
 * concurrent inserts), we encode a { createdAt, id } tuple. Queries then use
 * both fields for stable ordering:
 *
 *   WHERE (createdAt < cursor.createdAt)
 *      OR (createdAt = cursor.createdAt AND id < cursor.id)
 *   ORDER BY createdAt DESC, id DESC
 *
 * This ensures no rows are skipped or duplicated when new rows are inserted
 * between pages.
 */

export interface CursorTuple {
  createdAt: string;
  id: string;
}

/**
 * Encode a cursor tuple into an opaque base64url string.
 */
export function encodeCursor({ createdAt, id }: CursorTuple): string {
  const payload = JSON.stringify({ createdAt, id });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode an opaque base64url cursor string into a cursor tuple.
 * Returns null if the cursor is invalid.
 */
export function decodeCursor(cursor: string): CursorTuple | null {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload);
    if (
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string'
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Build a Prisma where clause for cursor-based pagination.
 * The cursor points to the last item of the previous page; we want items
 * strictly before it in (createdAt DESC, id DESC) order.
 */
export function buildCursorWhere<T extends { createdAt?: Date | string; id?: string }>(
  cursor: CursorTuple | null,
  dateField: keyof T = 'createdAt',
): Record<string, any> {
  if (!cursor) {
    return {};
  }

  const cursorDate = new Date(cursor.createdAt);

  return {
    [dateField]: {
      lt: cursorDate,
    },
    id: {
      lt: cursor.id,
    },
  };
}
