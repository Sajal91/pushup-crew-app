module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Worklets plugin (powers Reanimated 4) MUST be last in the list
      'react-native-worklets/plugin',
    ],
  };
};
