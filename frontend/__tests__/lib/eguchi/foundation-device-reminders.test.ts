import { beforeEach, expect, jest, test } from '@jest/globals';
import { deriveProgram, makeEvent, PREPARATION_IDS } from '@/lib/foundation/program';

const mockPlatform = { OS: 'ios' };
const mockDevice = { isDevice: true };
const mockExtra = {
  remotePushEnabled: true,
  remotePushPlatforms: ['ios'],
  eas: { projectId: 'project' },
};
const mockPermission = jest.fn<() => Promise<{ granted: boolean }>>();
const mockToken = jest.fn<() => Promise<{ data: string }>>();
const mockPost = jest.fn<(...args: unknown[]) => Promise<{ error?: string }>>();
const mockGet = jest.fn<() => Promise<{ token: string; owner: string } | null>>();
const mockSet = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSchedule = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockCancel = jest.fn<(...args: unknown[]) => Promise<void>>();
jest.mock('react-native', () => ({ Platform: mockPlatform }));
jest.mock('expo-device', () => mockDevice);
jest.mock('expo-constants', () => ({ expoConfig: { extra: mockExtra } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: () => {},
  getPermissionsAsync: () => mockPermission(),
  getExpoPushTokenAsync: () => mockToken(),
  getAllScheduledNotificationsAsync: async () => [{ identifier: 'foundation-old' }],
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));
jest.mock('@/lib/storage', () => ({
  storage: { get: () => mockGet(), set: (...args: unknown[]) => mockSet(...args) },
}));
jest.mock('@/lib/foundation/notification-plan', () => ({
  planLocalNotifications: () => [
    { id: 'foundation-next', at: new Date(), title: 'Practice', body: 'A little listening' },
  ],
}));

const { reconcileNotifications } =
  require('@/lib/foundation/notifications') as typeof import('@/lib/foundation/notifications');

const state = () =>
  deriveProgram([
    ...PREPARATION_IDS.map(lessonId => makeEvent('preparation', { lessonId })),
    makeEvent('preferences', { dailyPush: true }),
  ]);
beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'ios';
  mockDevice.isDevice = true;
  mockExtra.remotePushEnabled = true;
  mockPermission.mockResolvedValue({ granted: true });
  mockToken.mockResolvedValue({ data: 'ExpoPushToken[test]' });
  mockPost.mockResolvedValue({});
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue();
  mockSchedule.mockResolvedValue('foundation-next');
  mockCancel.mockResolvedValue();
});
test('a configured signed-in iPhone registers remotely and removes local duplicates', async () => {
  expect(await reconcileNotifications(state(), 'auth', 'parent')).toBe('remote');
  expect(mockPost).toHaveBeenCalledWith(
    '/api/foundation/device',
    { token: 'ExpoPushToken[test]' },
    'auth'
  );
  expect(mockSet).toHaveBeenCalledWith('eguchi_foundation_push_device', {
    token: 'ExpoPushToken[test]',
    owner: 'parent',
  });
  expect(mockCancel).toHaveBeenCalledWith('foundation-old');
  expect(mockSchedule).not.toHaveBeenCalled();
});
test('Android keeps local reminders until its own push credentials are configured', async () => {
  mockPlatform.OS = 'android';
  expect(await reconcileNotifications(state(), 'auth', 'parent')).toBe('local');
  expect(mockToken).not.toHaveBeenCalled();
  expect(mockSchedule).toHaveBeenCalledTimes(1);
});
test('guests and simulators retain local reminders', async () => {
  expect(await reconcileNotifications(state(), null, 'guest')).toBe('local');
  mockDevice.isDevice = false;
  expect(await reconcileNotifications(state(), 'auth', 'parent')).toBe('local');
  expect(mockToken).not.toHaveBeenCalled();
});
test('failed first remote registration falls back to local reminders', async () => {
  mockPost.mockResolvedValue({ error: 'Remote service unavailable' });
  expect(await reconcileNotifications(state(), 'auth', 'parent')).toBe('local');
  expect(mockSchedule).toHaveBeenCalledTimes(1);
});
test('a known remote device does not receive duplicate local reminders during an outage', async () => {
  mockToken.mockRejectedValue(new Error('Offline'));
  mockGet.mockResolvedValue({ token: 'ExpoPushToken[test]', owner: 'parent' });
  expect(await reconcileNotifications(state(), 'auth', 'parent')).toBe('remote');
  expect(mockSchedule).not.toHaveBeenCalled();
});
test('no permission or no opt-in means no remote registration', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  expect(await reconcileNotifications(state(), 'auth', 'parent')).toBe('denied');
  mockPermission.mockResolvedValue({ granted: true });
  expect(await reconcileNotifications(deriveProgram([]), 'auth', 'parent')).toBe('off');
  expect(mockPost).not.toHaveBeenCalled();
  expect(mockSchedule).not.toHaveBeenCalled();
});
