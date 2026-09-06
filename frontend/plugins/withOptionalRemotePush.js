const { withEntitlementsPlist } = require('@expo/config-plugins');

// Local reminders work without APNs. Enable remote push only after provisioning and
// Expo APNs/FCM credentials have been configured for this application's bundle ID.
module.exports = function withOptionalRemotePush(config) {
  return withEntitlementsPlist(config, mod => {
    if (config.extra?.remotePushEnabled !== true) delete mod.modResults['aps-environment'];
    return mod;
  });
};
