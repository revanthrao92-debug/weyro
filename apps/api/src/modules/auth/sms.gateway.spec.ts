import { ConsoleSmsGateway, HttpSmsGateway } from './sms.gateway';

describe('SMS gateways deliver the exact OTP code (C1)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ type: 'success' }) });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  it('MSG91 passes the code as the template variable and uses the template id', async () => {
    const gateway = new HttpSmsGateway('msg91', {
      MSG91_AUTH_KEY: 'key',
      MSG91_OTP_TEMPLATE_ID: 'tmpl_123',
      MSG91_SENDER_ID: 'WEYRO',
    });
    await gateway.sendOtp('+919876543210', '482913');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://control.msg91.com/api/v5/otp');
    expect(url.searchParams.get('otp')).toBe('482913');
    expect(url.searchParams.get('template_id')).toBe('tmpl_123');
    expect(url.searchParams.get('mobile')).toBe('919876543210');
    expect(fetchMock.mock.calls[0][1].headers.authkey).toBe('key');
  });

  it('MSG91 HTTP-200 error bodies are treated as delivery failures', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ type: 'error', message: 'bad template' }) });
    const gateway = new HttpSmsGateway('msg91', {
      MSG91_AUTH_KEY: 'k',
      MSG91_OTP_TEMPLATE_ID: 't',
      MSG91_SENDER_ID: 's',
    });
    await expect(gateway.sendOtp('+919876543210', '123456')).rejects.toThrow('bad template');
  });

  it('Twilio message body includes the code', async () => {
    const gateway = new HttpSmsGateway('twilio', {
      SMS_TWILIO_ACCOUNT_SID: 'AC1',
      SMS_TWILIO_AUTH_TOKEN: 'tok',
      SMS_TWILIO_FROM: '+15550001111',
    });
    await gateway.sendOtp('+919876543210', '482913');
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('Body')).toContain('482913');
    expect(body.get('To')).toBe('+919876543210');
  });

  it('refuses to send when credentials are missing', async () => {
    const gateway = new HttpSmsGateway('msg91', { MSG91_AUTH_KEY: 'k', MSG91_OTP_TEMPLATE_ID: undefined });
    await expect(gateway.sendOtp('+919876543210', '123456')).rejects.toThrow(/MSG91_OTP_TEMPLATE_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('real providers never log the code', async () => {
    const gateway = new HttpSmsGateway('msg91', {
      MSG91_AUTH_KEY: 'k',
      MSG91_OTP_TEMPLATE_ID: 't',
      MSG91_SENDER_ID: 's',
    });
    const logger = (gateway as unknown as { logger: { log: jest.Mock; error: jest.Mock } }).logger;
    const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    await gateway.sendOtp('+919876543210', '482913');
    for (const call of logSpy.mock.calls) expect(call.join(' ')).not.toContain('482913');
  });

  it('console driver is dev-only', async () => {
    const gateway = new ConsoleSmsGateway();
    await expect(gateway.sendOtp('+919876543210', '123456')).resolves.toBeUndefined();
  });
});
