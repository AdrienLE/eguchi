/**
 * Notification Provider Component
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { APP_CONFIG } from '@/lib/app-config';
import { notificationService } from './notificationService';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  requestPermissions: () => Promise<boolean>;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: Date;
  data?: any;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const requestPermissions = async (): Promise<boolean> => {
    return await notificationService.requestPermissions();
  };

  useEffect(() => {
    if (APP_CONFIG.features.enablePushNotifications) {
      notificationService.initialize();
    }
  }, []);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    requestPermissions,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotificationContext must be used within NotificationProvider'
    );
  }
  return context;
};
