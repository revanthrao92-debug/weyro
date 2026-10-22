module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // Database-backed e2e suites (real Postgres) are opt-in via jest-e2e.config.js
  testPathIgnorePatterns: ['/test/e2e-.*\\.spec\\.ts$'],
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
