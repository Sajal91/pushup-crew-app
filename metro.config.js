const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const wsShim = path.resolve(__dirname, 'src/shims/ws.js');
const punycodeShim = path.resolve(__dirname, 'node_modules/punycode/punycode.js');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolverMainFields = [
  'react-native',
  'browser',
  'module',
  'main',
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: wsShim,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws') {
    return {
      type: 'sourceFile',
      filePath: wsShim,
    };
  }

  if (moduleName === 'punycode') {
    return {
      type: 'sourceFile',
      filePath: punycodeShim,
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
