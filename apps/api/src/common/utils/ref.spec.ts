import { dammDigit, formatRef, parseRef, REF_TYPES, type RefType } from '@weyro/api-contracts';

describe('Weyro reference numbers', () => {
  it('Damm check digit matches the published example (572 -> 4)', () => {
    expect(dammDigit('572')).toBe(4);
    expect(dammDigit('5724')).toBe(0); // a valid number checks to 0
  });

  it('formats as <type>-<YYMMDD>-<count>-<check>', () => {
    const ref = formatRef('J', '261127', 42);
    expect(ref).toMatch(/^J-261127-0042-\d$/);
    expect(parseRef(ref)).toEqual({ type: 'J', label: 'Job', day: '261127', count: 42, ref });
  });

  it('counts past 9999 keep working (5+ digits)', () => {
    const ref = formatRef('O', '261127', 12345);
    expect(ref).toMatch(/^O-261127-12345-\d$/);
    expect(parseRef(ref)?.count).toBe(12345);
  });

  it('accepts how people type it: lower case, spaces, no dashes', () => {
    const ref = formatRef('T', '261201', 7);
    const [, day, count, check] = ref.split('-');
    expect(parseRef(` t ${day} ${count} ${check} `)?.ref).toBe(ref);
    expect(parseRef(`T${day}${count}${check}`)?.ref).toBe(ref);
  });

  it('rejects bad formats, unknown types and impossible dates', () => {
    for (const bad of ['', 'J-261127-0042', 'X-261127-0042-1', 'J-26112-0042-1', 'J-261327-0042-1', 'J-261100-0042-1', 'J-261127-042-1']) {
      expect(parseRef(bad)).toBeNull();
    }
  });

  // The two mistakes people make reading numbers out: one wrong digit, two neighbours swapped.
  const samples: string[] = [];
  for (const type of Object.keys(REF_TYPES) as RefType[]) {
    for (const [day, count] of [['261127', 1], ['261231', 42], ['270101', 9999], ['270615', 10234]] as const) {
      samples.push(formatRef(type, day, count));
    }
  }

  it('catches every single wrong digit', () => {
    let tried = 0;
    for (const ref of samples) {
      const chars = ref.split('');
      chars.forEach((ch, i) => {
        if (!/\d/.test(ch)) return;
        for (let d = 0; d <= 9; d++) {
          if (String(d) === ch) continue;
          const wrong = [...chars];
          wrong[i] = String(d);
          tried++;
          // Either the check digit rejects it, or the changed digit made an impossible date (also rejected).
          expect(parseRef(wrong.join(''))).toBeNull();
        }
      });
    }
    expect(tried).toBeGreaterThan(1000);
  });

  it('catches every swap of two neighbouring different digits', () => {
    let tried = 0;
    for (const ref of samples) {
      const digits = ref.replace(/^[A-Z]-/, '').replace(/-/g, '');
      for (let i = 0; i < digits.length - 1; i++) {
        if (digits[i] === digits[i + 1]) continue;
        const swapped = digits.slice(0, i) + digits[i + 1] + digits[i] + digits.slice(i + 2);
        const countLen = digits.length - 7; // 6 date digits + 1 check
        const rebuilt = `${ref[0]}-${swapped.slice(0, 6)}-${swapped.slice(6, 6 + countLen)}-${swapped.slice(-1)}`;
        tried++;
        expect(parseRef(rebuilt)).toBeNull();
      }
    }
    expect(tried).toBeGreaterThan(100);
  });

  it('a different type letter never validates with the same digits', () => {
    const ref = formatRef('J', '261127', 42);
    for (const other of Object.keys(REF_TYPES).filter((t) => t !== 'J')) {
      expect(parseRef(`${other}${ref.slice(1)}`)).toBeNull();
    }
  });
});
