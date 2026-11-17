import { UserRole } from '@weyro/api-contracts';

export interface AuthUserPayload {
  sub: string;
  /** Absent for accounts created by phone OTP that never added an email. */
  email?: string;
  phone: string;
  role: UserRole;
  customerProfileId?: string;
  providerProfileId?: string;
  verificationStatus?: string;
}
