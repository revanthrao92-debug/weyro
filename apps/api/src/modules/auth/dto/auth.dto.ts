import { RegisterInput, LoginInput } from '@weyro/validation';

export class RegisterDto implements RegisterInput {
  email!: string;
  phone!: string;
  password!: string;
  role!: 'CUSTOMER' | 'PROVIDER' | 'BOTH';
  firstName!: string;
  lastName!: string;
  businessName?: string;
  providerType?:
    | 'MECHANIC'
    | 'GARAGE'
    | 'AUTHORIZED_CENTER'
    | 'PARTS_DEALER'
    | 'TOWING'
    | 'ROADSIDE';
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export class LoginDto implements LoginInput {
  emailOrPhone!: string;
  password!: string;
  email?: string; // Backwards compatibility if passed
}

export class RefreshTokenDto {
  refreshToken!: string;
}
