import { LoginSchema, RegisterSchema, SendOtpSchema, VerifyOtpSchema, ResetPasswordSchema, normalizePhone } from '@weyro/validation';
import { updateProviderProfileSchema } from '../providers/dto/providers.dto';

/**
 * H3: every phone input shape must collapse to one E.164 value so the same
 * person can never end up as two accounts (or two OTP rows).
 */
describe('H3 – phone normalization', () => {
  const variants = ['9876543210', '09876543210', '+91 98765 43210', '+919876543210', '91 9876543210'];

  it.each(variants)('%s → +919876543210', (input) => {
    expect(normalizePhone(input)).toBe('+919876543210');
  });

  it('all variants map to the same account in every schema with a phone field', () => {
    const base = {
      email: 'a@example.com',
      otpCode: '123456',
      password: 'Passw0rd1',
      role: 'CUSTOMER',
    };
    for (const input of variants) {
      expect(RegisterSchema.parse({ ...base, phone: input }).phone).toBe('+919876543210');
      expect(SendOtpSchema.parse({ phone: input }).phone).toBe('+919876543210');
      expect(VerifyOtpSchema.parse({ phone: input, code: '123456' }).phone).toBe('+919876543210');
      expect(
        ResetPasswordSchema.parse({ phone: input, code: '123456', newPassword: 'Passw0rd1' }).phone,
      ).toBe('+919876543210');
      expect(updateProviderProfileSchema.parse({ phone: input }).phone).toBe('+919876543210');
    }
  });

  it.each(['12345', '0000000000', 'abcdefghij', '+91 12345', '98765'])(
    'rejects invalid number %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
      expect(SendOtpSchema.safeParse({ phone: input }).success).toBe(false);
    },
  );

  it('login identifier stays free-form (email or phone) and is normalized by the service', () => {
    expect(LoginSchema.parse({ emailOrPhone: '09876543210', password: 'x' }).emailOrPhone).toBe(
      '09876543210',
    );
  });
});
