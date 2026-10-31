/** Minimal Jest setup for mobile unit tests (H6 refresh logic, shared utils). */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.spec.(ts|tsx|js)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo/html-elements|@expo-google|react-native-svg|lucide-react-native)',
  ],
  coverageDirectory: './coverage',
};
