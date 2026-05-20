const appJson = require('../app.json');
const easJson = require('../eas.json');

describe('Expo app configuration', () => {
  test('production iPad build supports rotation', () => {
    expect(appJson.expo.orientation).toBe('default');
    expect(appJson.expo.ios.supportsTablet).toBe(true);
    expect(appJson.expo.plugins[0]).toEqual([
      'expo-router',
      { origin: 'https://eguchi-api-production.up.railway.app' },
    ]);
  });

  test('production EAS profiles target Railway and include a simulator build', () => {
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
