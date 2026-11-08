const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../lib')];

// The web app and mobile app install separate React versions. Shared hooks must use mobile React.
const mobileEntry = path.join(__dirname, 'index.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = /^react(?:\/|$)/.test(moduleName)
    ? { ...context, originModulePath: mobileEntry }
    : context;
  return context.resolveRequest(origin, moduleName, platform);
};

module.exports = config;
