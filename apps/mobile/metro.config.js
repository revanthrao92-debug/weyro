const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// Sentry's version of Expo's default config: adds debug IDs so crash reports from store
// builds and over-the-air updates map back to the real source lines.
const config = getSentryExpoConfig(__dirname);

// Required for NativeWind to compile global.css into classNames on native.
module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
