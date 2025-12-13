// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      // use automatic runtime so you don't need `import React from 'react'` in every file
      ['@babel/preset-react', { runtime: 'automatic' }]
    ],
    plugins: [
      'expo-router/babel'
    ],
  };
};

