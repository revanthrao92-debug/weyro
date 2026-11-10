import { idParamSchema } from './id-param.schema';

describe('idParamSchema', () => {
  it('accepts opaque cuid/uuid style ids', () => {
    expect(idParamSchema.parse('clx123abc-456_DEF')).toBe('clx123abc-456_DEF');
  });

  it('rejects empty, oversized and traversal-style ids', () => {
    expect(idParamSchema.safeParse('').success).toBe(false);
    expect(idParamSchema.safeParse('a'.repeat(65)).success).toBe(false);
    expect(idParamSchema.safeParse('../etc/passwd').success).toBe(false);
    expect(idParamSchema.safeParse('id with spaces').success).toBe(false);
    expect(idParamSchema.safeParse('id;drop').success).toBe(false);
  });
});
