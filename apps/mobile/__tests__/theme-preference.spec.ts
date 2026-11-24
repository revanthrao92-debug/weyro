import { resolveColorScheme } from '../src/theme/preference';

describe('resolveColorScheme', () => {
  it('uses an explicit choice as is', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });

  it('follows the phone for "system", and stays dark when the phone says nothing', () => {
    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', null)).toBe('dark');
  });
});
