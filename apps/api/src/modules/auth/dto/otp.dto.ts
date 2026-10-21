import {
  SendOtpSchema,
  SendOtpInput,
  VerifyOtpSchema,
  VerifyOtpInput,
} from '@weyro/validation';

export class SendOtpDto implements SendOtpInput {
  static readonly schema = SendOtpSchema;

  phone!: string;
  purpose: 'login' | 'register' | 'reset_password' = 'login';
}

export class VerifyOtpDto implements VerifyOtpInput {
  static readonly schema = VerifyOtpSchema;

  phone!: string;
  code!: string;
  purpose: 'login' | 'register' | 'reset_password' = 'login';
}
