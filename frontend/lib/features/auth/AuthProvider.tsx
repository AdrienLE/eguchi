/**
 * Auth Provider Component
 *
 * Wraps the app with authentication context when the auth feature is enabled
 */

import React from 'react';
import { AuthProvider as MainAuthProvider } from '@/auth/AuthContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // This is a wrapper that uses the existing AuthProvider
  // but provides feature-specific enhancements

  return <MainAuthProvider>{children}</MainAuthProvider>;
};
