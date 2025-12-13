// webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // add alias so any `react-native-maps` or RN internals resolve to our web-safe shims
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    'react-native-maps': path.resolve(__dirname, 'web-shims/react-native-maps.js'),
    'react-native/Libraries/Utilities/codegenNativeCommands': path.resolve(__dirname, 'web-shims/codegenNativeCommands.js'),
  };

  return config;
};
