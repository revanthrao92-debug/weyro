const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Required for NativeWind to compile global.css into classNames on native.
module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
