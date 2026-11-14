import { z } from 'zod';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ResetPasswordSchema,
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ResetPasswordInput,
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
    | 'ROADSIDE'
    | 'DRIVER';
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  towingVehicleTypes?: ('FLATBED' | 'HOOK_AND_CHAIN' | 'MOTORCYCLE' | 'ANY')[];
  maxVehicleWeightKg?: number;
  towingBaseFee?: number;
  towingPerKmFee?: number;
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

export class ResetPasswordDto implements ResetPasswordInput {
  static readonly schema = ResetPasswordSchema;

  phone!: string;
  code!: string;
  newPassword!: string;
}


export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
    pushToken: z.string().min(1).max(512).optional(),
  })
  .strict();

export class LogoutDto implements z.infer<typeof logoutSchema> {
  static readonly schema = logoutSchema;
  refreshToken?: string;
  pushToken?: string;
}
