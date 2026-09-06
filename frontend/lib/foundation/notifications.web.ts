import type { ProgramState } from './program';
export type NotificationMode = 'remote' | 'local' | 'off' | 'denied' | 'web';
export const notificationPermission = async () => false;
export const requestDevicePermission = async () => false;
export const disconnectDevice = async (_token: string | null, _owner: string) => {};
export const reconcileNotifications = async (
  _state: ProgramState,
  _token: string | null,
  _owner: string
): Promise<NotificationMode> => 'web';
