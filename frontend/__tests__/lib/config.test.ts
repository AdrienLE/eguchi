import { jest } from '@jest/globals';

const reloadConfig = (env: Record<string, string | undefined>) => {
  jest.resetModules();
  const original = process.env;
  process.env = { ...original, ...env } as any;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../lib/config');
  process.env = original;
  return mod.APP_CONFIG;
};

describe('APP_CONFIG API URL precedence', () => {
  test('production-specific override wins over generic', () => {
    const cfg = reloadConfig({
      EXPO_PUBLIC_ENVIRONMENT: 'production',
      EXPO_PUBLIC_API_URL: 'https://generic.example.com',
      EXPO_PUBLIC_API_URL_PRODUCTION: 'https://prod.example.com',
    });
    expect(cfg.api.baseUrl).toBe('https://prod.example.com');
  });

  test('generic override used when specific missing', () => {
    const cfg = reloadConfig({
      EXPO_PUBLIC_ENVIRONMENT: 'staging',
      EXPO_PUBLIC_API_URL: 'https://generic.example.com',
    });
    expect(cfg.api.baseUrl).toBe('https://generic.example.com');
  });

  test('falls back to hardcoded default', () => {
    const cfg = reloadConfig({ EXPO_PUBLIC_ENVIRONMENT: 'production' });
    expect(cfg.api.baseUrl).toMatch('https://baseapp-production-');
  });
});
