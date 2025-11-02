import { jest } from '@jest/globals';

// Mock the notification provider context
jest.mock('@/lib/features/notifications/NotificationProvider', () => ({
  useNotificationContext: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: jest.fn(),
    clearAll: jest.fn(),
    requestPermissions: jest.fn(async () => true),
  }),
}));

// Mock app-config to control flags/services
jest.mock('@/lib/app-config', () => ({
  APP_CONFIG: {
    features: { enablePushNotifications: true },
    services: { notifications: { provider: 'expo' } },
  },
}));

import { useNotifications } from '@/lib/features/notifications/useNotifications';

describe('useNotifications', () => {
  test('exposes context, enable flag, and config', () => {
    const n = useNotifications();
    expect(n.isEnabled).toBe(true);
    expect(n.config).toEqual({ provider: 'expo' });
    expect(Array.isArray(n.notifications)).toBe(true);
    expect(n.unreadCount).toBe(0);
  });
});
