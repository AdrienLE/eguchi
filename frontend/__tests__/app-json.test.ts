import { describe, expect, test } from '@jest/globals';

const appJson = require('../app.json');
const easJson = require('../eas.json');
const configureApp = require('../app.config');

describe('Expo app configuration', () => {
  test('wireless updates are compatible, nonblocking and configured for this project', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'fingerprint' });
    expect(appJson.expo.updates.url).toBe(`https://u.expo.dev/${appJson.expo.extra.eas.projectId}`);
    expect(appJson.expo.updates.checkAutomatically).toBe('ON_LOAD');
    expect(appJson.expo.updates.fallbackToCacheTimeout).toBe(0);
  });

  test.each([
    ['production', 'production'],
    ['production-simulator', 'production'],
    ['app-store', 'production'],
    ['staging', 'staging'],
    ['development', 'development'],
  ])('native builds use the %s profile channel', (profile, channel) => {
    const previous = process.env.EAS_BUILD_PROFILE;
    try {
      process.env.EAS_BUILD_PROFILE = profile;
      const config = configureApp({ config: appJson.expo });
      expect(config.updates.requestHeaders['expo-channel-name']).toBe(channel);
      expect(config.updates.url).toBe(appJson.expo.updates.url);
      expect(config.extra).toEqual(appJson.expo.extra);
    } finally {
      if (previous === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = previous;
    }
  });

  test('unknown build profiles cannot silently receive production updates', () => {
    const previous = process.env.EAS_BUILD_PROFILE;
    try {
      process.env.EAS_BUILD_PROFILE = 'typo';
      expect(() => configureApp({ config: appJson.expo })).toThrow('Invalid EAS build profile');
    } finally {
      if (previous === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = previous;
    }
  });

  test('production iPad build supports rotation', () => {
    expect(appJson.expo.orientation).toBe('default');
    expect(appJson.expo.ios.supportsTablet).toBe(true);
    expect(appJson.expo.plugins).toContain('./plugins/withFmtXcode26Fix');
    const routerPlugin = appJson.expo.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-router'
    );
    expect(routerPlugin).toEqual([
      'expo-router',
      { origin: 'https://eguchi-api-production.up.railway.app' },
    ]);
  });

  test('production EAS profiles target Railway and include a simulator build', () => {
    expect(easJson.build.development.env.EXPO_PUBLIC_AUTH0_CLIENT_ID).toBe(
      'anmRxoN5x2uWiXdjAyXe33kW4d8N81Vj'
    );
    expect(easJson.build.staging.env.EXPO_PUBLIC_AUTH0_AUDIENCE).toBe(
      'https://eguchi-api-production.up.railway.app/api'
    );
    expect(easJson.build.production.env.EXPO_PUBLIC_API_URL_PRODUCTION).toBe(
      'https://eguchi-api-production.up.railway.app'
    );
    expect(easJson.build.production.env.EXPO_PUBLIC_AUTH0_AUDIENCE).toBe(
      'https://eguchi-api-production.up.railway.app/api'
    );
    expect(easJson.build['production-simulator'].extends).toBe('production');
    expect(easJson.build['production-simulator'].ios.simulator).toBe(true);
  });
});
