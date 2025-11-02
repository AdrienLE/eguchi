/**
 * Notifications Feature Module
 *
 * Handles push notifications, in-app notifications, and notification preferences
 */

import { FeatureModule } from '../index';
// import { NotificationProvider } from './NotificationProvider'; // Disabled due to JSX issues
import { NotificationSettings } from './NotificationSettings';
import { useNotifications } from './useNotifications';
import { notificationService } from './notificationService';

export const notificationsFeature: FeatureModule = {
  name: 'notifications',
  version: '1.0.0',
  description: 'Push and in-app notifications',
  dependencies: ['auth'], // Notifications usually require auth

  components: {
    // NotificationProvider, // Disabled due to JSX issues
    NotificationSettings,
  },

  hooks: {
    useNotifications,
  },

  services: {
    notificationService,
  },

  routes: [
    {
      path: '/notifications/settings',
      component: NotificationSettings,
      exact: true,
      private: true,
    },
  ],

  initialize: async () => {
    console.log('Initializing notifications feature...');
    await notificationService.initialize();
  },

  cleanup: async () => {
    console.log('Cleaning up notifications feature...');
    await notificationService.cleanup();
  },
};

// export { NotificationProvider } from './NotificationProvider'; // Disabled
export { useNotifications } from './useNotifications';
export { notificationService } from './notificationService';
