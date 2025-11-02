/**
 * Auth Feature Hook
 *
 * Provides auth-related functionality when the auth feature is enabled
 */

import { useAuth } from '@/auth/AuthContext';
import { APP_CONFIG } from '@/lib/app-config';

export const useAuthFeature = () => {
  const auth = useAuth();

  return {
    ...auth,
    isAuthEnabled: APP_CONFIG.features.enableAuth,
    authConfig: APP_CONFIG.services.auth,

    // Feature-specific methods
    loginWithProvider: async (provider: string) => {
      // Implementation for different auth providers
      console.log(`Logging in with ${provider}`);
    },

    enableBiometric: async () => {
      if (APP_CONFIG.features.enableBiometricAuth) {
        // Enable biometric authentication
        console.log('Enabling biometric auth');
      }
    },
  };
};
