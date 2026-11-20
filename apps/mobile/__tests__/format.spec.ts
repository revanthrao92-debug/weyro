import { titleize } from '../src/utils/format';

describe('titleize', () => {
  it('replaces every underscore, not just the first', () => {
    expect(titleize('PROVIDER_EN_ROUTE')).toBe('Provider en route');
    expect(titleize('HELD_IN_ESCROW')).toBe('Held in escrow');
  });
});
