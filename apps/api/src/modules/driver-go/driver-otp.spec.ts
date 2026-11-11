import { hashDriverStartOtp, verifyDriverStartOtp } from './driver-otp';

describe('Driver Go start OTP', () => {
  it('verifies the matching code and rejects others', () => {
    const hash = hashDriverStartOtp('1234');
    expect(verifyDriverStartOtp('1234', hash)).toBe(true);
    expect(verifyDriverStartOtp('4321', hash)).toBe(false);
    expect(verifyDriverStartOtp('1234', null)).toBe(false);
  });

  it('never stores the plaintext code in the hash', () => {
    expect(hashDriverStartOtp('1234')).not.toContain('1234');
    expect(hashDriverStartOtp('1234')).toHaveLength(64);
  });
});
