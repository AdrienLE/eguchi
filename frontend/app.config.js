const eas = require('./eas.json');

function channelForProfile(name, seen = new Set()) {
  const profile = eas.build[name];
  if (!profile || seen.has(name)) throw new Error(`Invalid EAS build profile: ${name}`);
  seen.add(name);
  if (profile.channel) return profile.channel;
  if (profile.extends) return channelForProfile(profile.extends, seen);
  throw new Error(`Set an update channel for EAS build profile: ${name}`);
}

// The cached Xcode builder and update publisher set the same profile as EAS Build.
module.exports = ({ config }) => ({
  ...config,
  updates: {
    ...config.updates,
    requestHeaders: {
      ...config.updates?.requestHeaders,
      'expo-channel-name': channelForProfile(process.env.EAS_BUILD_PROFILE || 'production'),
    },
  },
});
