/**
 * Babel Configuration for Aura Browser
 * Optimized for performance with Hermes JS engine
 */
module.exports = function (api) {
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Reanimated plugin must be last
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: [
          // Remove console.log statements in production for smaller bundle
          'transform-remove-console',
        ],
      },
    },
  };
};
