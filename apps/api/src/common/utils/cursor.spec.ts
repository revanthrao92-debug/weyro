import { buildCursorWhere, decodeCursor, encodeCursor } from './cursor';

/** Tiny evaluator for the exact where-shape buildCursorWhere returns. */
function matches(row: { createdAt: Date; id: string }, where: Record<string, any>): boolean {
  if (!where.OR) return true;
  return where.OR.some((clause: any) => {
    const created = clause.createdAt;
    const createdOk =
      created instanceof Date ? row.createdAt.getTime() === created.getTime() : row.createdAt < created.lt;
    const idOk = clause.id ? row.id < clause.id.lt : true;
    return createdOk && idOk;
  });
}

describe('buildCursorWhere', () => {
  it('returns no filter for the first page', () => {
    expect(buildCursorWhere(null)).toEqual({});
  });

  it('is the (createdAt, id) tuple comparison, not createdAt AND id', () => {
    const where = buildCursorWhere({ createdAt: '2026-11-16T10:00:00.000Z', id: 'm' });
    expect(where).toEqual({
      OR: [
        { createdAt: { lt: new Date('2026-11-16T10:00:00.000Z') } },
        { createdAt: new Date('2026-11-16T10:00:00.000Z'), id: { lt: 'm' } },
      ],
    });
  });

  it('pages through rows with tied timestamps and non-monotonic ids exactly once', () => {
    // 12 rows in groups of 4 sharing a createdAt; ids are random-looking (like uuids),
    // so id order has nothing to do with time order.
    const ids = ['f3', '0a', '9c', 'b1', '44', 'e8', '21', 'd7', '6f', 'a5', '1b', '8e'];
    const rows = ids.map((id, i) => ({ id, createdAt: new Date(Date.UTC(2026, 10, 16, 10, 0, 0) - Math.floor(i / 4) * 60_000) }));
    const ordered = [...rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1),
    );

    for (const pageSize of [1, 2, 3, 5, 7]) {
      const seen: string[] = [];
      let cursor: ReturnType<typeof decodeCursor> = null;
      for (let guard = 0; guard < 50; guard++) {
        const where = buildCursorWhere(cursor);
        const page = ordered.filter((r) => matches(r, where)).slice(0, pageSize);
        seen.push(...page.map((r) => r.id));
        if (page.length < pageSize) break;
        const last = page[page.length - 1];
        cursor = decodeCursor(encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }));
      }
      expect(seen).toEqual(ordered.map((r) => r.id)); // every row, once, in order
    }
  });
});
