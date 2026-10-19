import { UserRole } from '@weyro/api-contracts';

export interface AuthUserPayload {
  sub: string;
  email: string;
  phone: string;
  role: UserRole;
  customerProfileId?: string;
  providerProfileId?: string;
  verificationStatus?: string;
}
