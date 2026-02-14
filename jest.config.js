module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/style-mock.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|@react-native|react-native-gesture-handler|react-native-reanimated|react-native-worklets|react-native-safe-area-context|@gorhom|heroui-native|uniwind|tailwind-merge|tailwind-variants|react-i18next|i18next)/',
  ],
};
