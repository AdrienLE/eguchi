const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
const { compileModsAsync } = require('@expo/config-plugins');
test('the actual Expo plugin chain removes APNs for local reminder builds', async () => {
  const { exp } = await getPrebuildConfigAsync(process.cwd(), { platforms: ['ios'] });
  expect(exp.extra.remotePushEnabled).toBe(false);
  const result = await compileModsAsync(exp, {
    projectRoot: process.cwd(),
    platforms: ['ios'],
    introspect: true,
  });
  expect(result._internal.modResults.ios.entitlements['aps-environment']).toBeUndefined();
});
