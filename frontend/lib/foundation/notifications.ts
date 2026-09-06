import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { planLocalNotifications } from './notification-plan';
import type { ProgramState } from './program';

const DEVICE_KEY = 'eguchi_foundation_push_device';
export interface DeviceRegistration {
  token: string;
  owner: string;
}
export type NotificationMode = 'remote' | 'local' | 'off' | 'denied' | 'web';
let pending: Promise<unknown> = Promise.resolve();
if (Platform.OS !== 'web')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: true,
    }),
  });
export const notificationPermission = async () => {
  if (Platform.OS === 'web') return false;
  const permission = await Notifications.getPermissionsAsync();
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};
export const requestDevicePermission = async () => {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('practice', {
      name: 'Parent practice reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  if (await notificationPermission()) return true;
  const permission = await Notifications.requestPermissionsAsync();
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};
const cancelLocal = async () => {
  if (Platform.OS === 'web') return;
  for (const notification of await Notifications.getAllScheduledNotificationsAsync()) {
    if (notification.identifier.startsWith('foundation-'))
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
};
export const disconnectDevice = (token: string | null, owner: string): Promise<void> => {
  const task = pending
    .catch(() => {})
    .then(async () => {
      await cancelLocal();
      const registration = await storage.get<DeviceRegistration>(DEVICE_KEY);
      if (registration && token && registration.owner === owner) {
        const result = await api.post(
          '/api/foundation/device/remove',
          { token: registration.token },
          token
        );
        if (result.error)
          throw new Error('Connect to the internet to disconnect reminders before signing out.');
        await storage.remove(DEVICE_KEY);
      }
    });
  pending = task;
  return task;
};
export const reconcileNotifications = (
  state: ProgramState,
  token: string | null,
  owner: string
): Promise<NotificationMode> => {
  const task = pending
    .catch(() => {})
    .then(async (): Promise<NotificationMode> => {
      if (Platform.OS === 'web') return 'web';
      if (!(await notificationPermission())) {
        await cancelLocal();
        return 'denied';
      }
      const enabled = state.preferences.dailyPush || state.preferences.reviewPush;
      if (!enabled) {
        await cancelLocal();
        return 'off';
      }
      // A signed-in, physical device can receive server reminders even without opening the app.
      // Simulator, guest, and credential failures use scheduled local device notifications.
      if (token && Device.isDevice && Constants.expoConfig?.extra?.remotePushEnabled === true) {
        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId;
          const result = await Notifications.getExpoPushTokenAsync({ projectId });
          const response = await api.post('/api/foundation/device', { token: result.data }, token);
          if (!response.error) {
            await storage.set<DeviceRegistration>(DEVICE_KEY, { token: result.data, owner });
            await cancelLocal();
            return 'remote';
          }
        } catch {
          /* Local scheduling remains available when remote push is not configured. */
        }
        const existing = await storage.get<DeviceRegistration>(DEVICE_KEY);
        if (existing?.owner === owner) {
          // Do not create a second local channel while this device may receive remote alerts.
          return 'remote';
        }
      }
      await cancelLocal();
      for (const item of planLocalNotifications(state))
        await Notifications.scheduleNotificationAsync({
          identifier: item.id,
          content: { title: item.title, body: item.body, sound: 'default', data: { route: '/' } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.at,
            channelId: 'practice',
          },
        });
      return 'local';
    });
  pending = task;
  return task;
};
