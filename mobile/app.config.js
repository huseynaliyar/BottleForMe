module.exports = ({ config }) => {
  const googleServicesFile = process.env.BOTTLEFORME_GOOGLE_SERVICES_FILE;
  const androidGoogleMapsApiKey = process.env.BOTTLEFORME_ANDROID_MAPS_API_KEY;
  const plugins = [
    ...(config.plugins ?? []),
    ['expo-notifications', { defaultChannel: 'bottleforme-messages' }],
    ['expo-location', { locationWhenInUsePermission: 'Allow BottleForMe to suggest a nearby pickup locality.' }],
    ['expo-image-picker', { photosPermission: 'Allow BottleForMe to select a profile photo.', cameraPermission: false, microphonePermission: false }],
  ];
  if (androidGoogleMapsApiKey) plugins.push(['react-native-maps', { androidGoogleMapsApiKey }]);
  return {
    ...config,
    plugins,
    extra: { ...config.extra, androidRadarMap: !!androidGoogleMapsApiKey },
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
