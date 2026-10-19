import {
  VerifyProviderSchema,
  VerifyProviderInput,
} from '@weyro/validation';

export class VerifyProviderDto implements VerifyProviderInput {
  static readonly schema = VerifyProviderSchema;

  status!: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  auditorNotes?: string;
}
