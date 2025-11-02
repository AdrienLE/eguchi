/**
 * Authentication Feature Module
 *
 * Handles user authentication, token management, and auth-related UI components
 */

import { FeatureModule } from '../index';
import { AuthProvider } from './AuthProvider';
import { LoginScreen } from './LoginScreen';
import { useAuthFeature } from './useAuthFeature';
import { authService } from './authService';

export const authFeature: FeatureModule = {
  name: 'auth',
  version: '1.0.0',
  description: 'User authentication and authorization',

  components: {
    AuthProvider,
    LoginScreen,
  },

  hooks: {
    useAuth: useAuthFeature,
  },

  services: {
    authService,
  },

  routes: [
    {
      path: '/login',
      component: LoginScreen,
      exact: true,
      private: false,
    },
  ],

  initialize: async () => {
    console.log('Initializing auth feature...');
    // Initialize auth service, check for existing tokens, etc.
    await authService.initialize();
  },

  cleanup: async () => {
    console.log('Cleaning up auth feature...');
    await authService.cleanup();
  },
};

// Re-export auth-related functionality
export { AuthProvider } from './AuthProvider';
export { useAuthFeature } from './useAuthFeature';
export { authService } from './authService';
