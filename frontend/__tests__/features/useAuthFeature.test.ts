import { jest } from '@jest/globals';
// Mock the auth context provider
jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: 't1', login: jest.fn(), logout: jest.fn(), loading: false }),
}));

// Mock app-config to control feature flags and services
jest.mock('@/lib/app-config', () => ({
  APP_CONFIG: {
    features: { enableAuth: true, enableBiometricAuth: true },
    services: { auth: { provider: 'auth0' } },
  },
}));

import { useAuthFeature } from '@/lib/features/auth/useAuthFeature';

describe('useAuthFeature', () => {
  test('exposes auth context and feature metadata', () => {
    const feature = useAuthFeature();
    expect(feature.token).toEqual('t1');
    expect(feature.isAuthEnabled).toBe(true);
    expect(feature.authConfig).toEqual({ provider: 'auth0' });
    expect(typeof feature.loginWithProvider).toBe('function');
    expect(typeof feature.enableBiometric).toBe('function');
  });
});
