const mockInit = jest.fn();
const mockSetTags = jest.fn();
jest.mock('@sentry/react-native', () => ({ init: (...a: unknown[]) => mockInit(...a), setTags: (...a: unknown[]) => mockSetTags(...a) }));
jest.mock('expo-updates', () => ({ updateId: 'upd-123', isEmbeddedLaunch: false, channel: 'production', runtimeVersion: 'fp-abc' }));
jest.mock('@weyro/api-contracts', () => ({ scrubSentryEvent: (e: unknown) => e, scrubValue: (v: unknown) => v }));

// eslint-disable-next-line import/first
import { updateTags } from '../src/lib/sentry';

describe('sentry update tags', () => {
  it('tags crashes with the running update', () => {
    expect(updateTags({ updateId: 'u1', isEmbeddedLaunch: true, channel: 'preview', runtimeVersion: 'r1' })).toEqual({
      'expo-update-id': 'u1',
      'expo-is-embedded-update': 'true',
      'expo-channel': 'preview',
      'expo-runtime-version': 'r1',
    });
  });

  it('adds nothing in development or on web (no update id)', () => {
    expect(updateTags({ updateId: null, isEmbeddedLaunch: true, channel: null, runtimeVersion: null })).toEqual({});
  });

  it('sets the tags when Sentry starts with a DSN', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initSentry } = require('../src/lib/sentry');
      expect(initSentry()).toBe(true);
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    });
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockSetTags).toHaveBeenCalledWith(expect.objectContaining({ 'expo-update-id': 'upd-123', 'expo-channel': 'production' }));
  });

  it('stays off without a DSN', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initSentry } = require('../src/lib/sentry');
      expect(initSentry()).toBe(false);
    });
  });
});
