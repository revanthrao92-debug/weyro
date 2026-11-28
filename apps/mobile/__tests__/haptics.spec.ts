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

  it('swallows a device rejection instead of leaving it unhandled', async () => {
    const rejection = Promise.reject(new Error('no haptic engine'));
    const caught = jest.spyOn(rejection, 'catch');
    mockImpact.mockReturnValue(rejection);
    haptics.tap();
    expect(caught).toHaveBeenCalled();
    await rejection.catch(() => undefined);
  });
});
