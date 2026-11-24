import { parseThemePreference, resolveColorScheme } from '../src/theme/preference';

describe('appearance preference', () => {
  it('keeps an explicit Light or Dark choice', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(resolveColorScheme('light')).toBe('light');
  });

  it('falls back to dark when nothing is saved or an old "system" value is saved', () => {
    expect(parseThemePreference(null)).toBe('dark');
    expect(parseThemePreference('system')).toBe('dark');
  });
});
