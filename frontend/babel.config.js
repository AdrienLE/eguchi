// babel.config.js (Expo managed)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // If you use Reanimated, add this as the LAST plugin:
    // plugins: ['react-native-reanimated/plugin'],
  };
};
