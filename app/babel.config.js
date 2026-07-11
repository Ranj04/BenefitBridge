module.exports = function (api) {
  api.cache(true);
  return {
    // NativeWind v5: no jsxImportSource — its babel preset (re-exporting
    // react-native-css/babel) handles className transforms itself.
    presets: ['babel-preset-expo', 'nativewind/babel'],
  };
};
