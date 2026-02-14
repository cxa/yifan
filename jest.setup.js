require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  Reanimated.default.call = () => {};
  Reanimated.useReducedMotion = () => false;

  return Reanimated;
});

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);
