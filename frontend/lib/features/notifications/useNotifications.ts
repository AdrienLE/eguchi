/**
 * Notifications Hook
 */

import { useNotificationContext } from './NotificationProvider';
import { APP_CONFIG } from '@/lib/app-config';

export const useNotifications = () => {
  const context = useNotificationContext();

  return {
    ...context,
    isEnabled: APP_CONFIG.features.enablePushNotifications,
    config: APP_CONFIG.services.notifications,

    // Helper methods
    showLocalNotification: (title: string, body: string) => {
      // Show local notification
      console.log('Showing local notification:', title, body);
    },

    scheduleNotification: (title: string, body: string, scheduledTime: Date) => {
      // Schedule a notification
      console.log('Scheduling notification for:', scheduledTime);
    },
  };
};
