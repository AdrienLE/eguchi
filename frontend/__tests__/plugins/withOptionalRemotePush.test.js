const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
const { compileModsAsync } = require('@expo/config-plugins');
test('the actual Expo plugin chain enables APNs only for configured iOS builds', async () => {
  const { exp } = await getPrebuildConfigAsync(process.cwd(), { platforms: ['ios'] });
  expect(exp.extra.remotePushEnabled).toBe(true);
  expect(exp.extra.remotePushPlatforms).toEqual(['ios']);
  const result = await compileModsAsync(exp, {
    projectRoot: process.cwd(),
    platforms: ['ios'],
    introspect: true,
  });
  expect(result._internal.modResults.ios.entitlements['aps-environment']).toBe('production');
});
test.each([
  { remotePushEnabled: false, remotePushPlatforms: ['ios'] },
  { remotePushEnabled: true, remotePushPlatforms: ['android'] },
])('local-only iOS builds omit APNs: %o', async extra => {
  const { exp } = await getPrebuildConfigAsync(process.cwd(), { platforms: ['ios'] });
  exp.extra = { ...exp.extra, ...extra };
  const result = await compileModsAsync(exp, {
    projectRoot: process.cwd(),
    platforms: ['ios'],
    introspect: true,
  });
  expect(result._internal.modResults.ios.entitlements['aps-environment']).toBeUndefined();
});
