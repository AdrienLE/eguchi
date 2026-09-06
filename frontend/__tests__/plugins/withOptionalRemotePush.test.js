jest.mock('@expo/config-plugins', () => ({
  withEntitlementsPlist: (config, action) =>
    action({ ...config, modResults: { 'aps-environment': 'development', retained: true } }),
}));
const plugin = require('../../plugins/withOptionalRemotePush');
test('local reminder builds do not require APNs entitlements', () => {
  expect(plugin({ extra: { remotePushEnabled: false } }).modResults).toEqual({ retained: true });
});
test('explicit remote push configuration preserves the notification entitlement', () => {
  expect(plugin({ extra: { remotePushEnabled: true } }).modResults['aps-environment']).toBe(
    'development'
  );
});
