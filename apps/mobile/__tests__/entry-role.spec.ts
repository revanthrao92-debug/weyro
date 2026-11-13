import {
  accountInterface,
  roleButtonLabel,
  roleMatches,
  roleMismatchMessage,
} from '../src/auth/entryRole';

describe('login entry role mapping', () => {
  it('maps customers and customer-only BOTH accounts to Customer', () => {
    expect(accountInterface({ role: 'CUSTOMER' })).toBe('CUSTOMER');
    expect(accountInterface({ role: 'BOTH', providerProfile: null })).toBe(
      'CUSTOMER',
    );
  });

  it('maps parts dealers to Dealer', () => {
    expect(
      accountInterface({
        role: 'PROVIDER',
        providerProfile: { providerType: 'PARTS_DEALER' },
      }),
    ).toBe('DEALER');
  });

  it.each(['MECHANIC', 'GARAGE', 'AUTHORIZED_CENTER'])(
    'maps %s to Mechanic / Garage',
    (providerType) => {
      expect(
        accountInterface({
          role: 'PROVIDER',
          providerProfile: { providerType },
        }),
      ).toBe('MECHANIC');
    },
  );

  it.each(['TOWING', 'ROADSIDE', 'DRIVER'])(
    'maps %s to Other',
    (providerType) => {
      expect(
        accountInterface({
          role: 'PROVIDER',
          providerProfile: { providerType },
        }),
      ).toBe('OTHER');
    },
  );

  it('maps admins to Other with an Admin-specific error', () => {
    const admin = { role: 'ADMIN', providerProfile: null };
    expect(accountInterface(admin)).toBe('OTHER');
    expect(roleMatches(admin, 'OTHER')).toBe(true);
    expect(roleMismatchMessage(admin)).toContain('signs in as Admin');
    expect(roleMismatchMessage(admin)).toContain('Select Other');
  });

  it('rejects a mismatched interface selection', () => {
    const dealer = {
      role: 'PROVIDER',
      providerProfile: { providerType: 'PARTS_DEALER' },
    };
    expect(roleMatches(dealer, 'CUSTOMER')).toBe(false);
    expect(roleMismatchMessage(dealer)).toContain('Select Dealer');
  });

  it('exposes button labels', () => {
    expect(roleButtonLabel('MECHANIC')).toBe('Mechanic / Garage');
    expect(roleButtonLabel('OTHER')).toBe('Other');
  });
});
