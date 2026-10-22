module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/test/e2e-postgis\\.spec\\.ts$'],
  transform: {
    // Type-checking is covered by `npm run typecheck:all`; skipping it inside
    // ts-jest cuts the test run from ~14s to ~3s.
    '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }],
  },
  silent: true,
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/__mocks__/expo-server-sdk.ts',
  },
  testEnvironment: 'node',
};
