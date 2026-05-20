const appJson = require('../app.json');

describe('Expo app configuration', () => {
  test('production iPad build supports rotation', () => {
    expect(appJson.expo.orientation).toBe('default');
    expect(appJson.expo.ios.supportsTablet).toBe(true);
  });
});
