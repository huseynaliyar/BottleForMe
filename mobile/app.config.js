module.exports = ({ config }) => {
  const androidGoogleMapsApiKey = process.env.BOTTLEFORME_ANDROID_MAPS_API_KEY;
  const plugins = [
    ...(config.plugins ?? []),
    ['expo-location', { locationWhenInUsePermission: 'Allow BottleForMe to suggest a nearby pickup locality.' }],
    ['expo-image-picker', { photosPermission: 'Allow BottleForMe to select a profile photo.', cameraPermission: false, microphonePermission: false }],
  ];
  if (androidGoogleMapsApiKey) plugins.push(['react-native-maps', { androidGoogleMapsApiKey }]);
  return { ...config, plugins };
};
