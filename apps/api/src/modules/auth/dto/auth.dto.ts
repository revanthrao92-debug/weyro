import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
} from '@weyro/validation';

export class RegisterDto implements RegisterInput {
  static readonly schema = RegisterSchema;
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
  static readonly schema = LoginSchema;
  emailOrPhone!: string;
  password!: string;
  email?: string;
}

export class RefreshTokenDto implements RefreshTokenInput {
  static readonly schema = RefreshTokenSchema;
  refreshToken!: string;
}
