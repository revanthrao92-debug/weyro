const mockImpact = jest.fn();
const mockNotify = jest.fn();
let mockOS = 'ios';

jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('expo-haptics', () => ({
  impactAsync: (...a: unknown[]) => mockImpact(...a),
  notificationAsync: (...a: unknown[]) => mockNotify(...a),
  ImpactFeedbackStyle: { Light: 'light', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// eslint-disable-next-line import/first
import { haptics } from '../src/lib/haptics';

describe('haptics', () => {
  beforeEach(() => {
    mockImpact.mockReset().mockResolvedValue(undefined);
    mockNotify.mockReset().mockResolvedValue(undefined);
    mockOS = 'ios';
  });

  it('fires the matching feedback on native', () => {
    haptics.heavy();
    haptics.success();
    expect(mockImpact).toHaveBeenCalledWith('heavy');
    expect(mockNotify).toHaveBeenCalledWith('success');
  });

  it('does nothing on web', () => {
    mockOS = 'web';
    haptics.tap();
    haptics.warning();
    expect(mockImpact).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('never throws when the device rejects', async () => {
    mockImpact.mockRejectedValue(new Error('no haptic engine'));
    expect(() => haptics.tap()).not.toThrow();
    await Promise.resolve();
  });
});
