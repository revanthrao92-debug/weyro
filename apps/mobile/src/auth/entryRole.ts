export type EntryRole = 'CUSTOMER' | 'DEALER' | 'MECHANIC' | 'OTHER';

export type AccountLike = {
  role?: string | null;
  providerProfile?: { providerType?: string | null } | null;
};

const MECHANIC_PROVIDER_TYPES = [
  'MECHANIC',
  'GARAGE',
  'AUTHORIZED_CENTER',
];

const OTHER_PROVIDER_TYPES = ['TOWING', 'ROADSIDE', 'DRIVER'];

/** Which login interface this account belongs to. */
export function accountInterface(account: AccountLike): EntryRole {
  if (account.role === 'ADMIN') return 'OTHER';
  const providerType = account.providerProfile?.providerType;
  if (providerType === 'PARTS_DEALER') return 'DEALER';
  if (providerType && MECHANIC_PROVIDER_TYPES.includes(providerType)) {
    return 'MECHANIC';
  }
  if (providerType && OTHER_PROVIDER_TYPES.includes(providerType)) {
    return 'OTHER';
  }
  return 'CUSTOMER';
}

export function roleMatches(account: AccountLike, role: EntryRole) {
  return accountInterface(account) === role;
}

export function roleButtonLabel(role: EntryRole) {
  switch (role) {
    case 'CUSTOMER':
      return 'Customer';
    case 'DEALER':
      return 'Dealer';
    case 'MECHANIC':
      return 'Mechanic / Garage';
    case 'OTHER':
      return 'Other';
  }
}

export function roleMismatchMessage(account: AccountLike): string {
  const actual = accountInterface(account);
  const buttonLabel = roleButtonLabel(actual);
  const accountLabel = account.role === 'ADMIN' ? 'Admin' : buttonLabel;
  return `This account signs in as ${accountLabel}. Select ${buttonLabel} and try again.`;
}
