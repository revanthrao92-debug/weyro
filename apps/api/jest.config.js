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
  // Phase 8: report coverage with thresholds pinned at the 2026-10-31
  // measured baseline (31.6% stmts / 31.1% branch / 26.7% func / 32.2% line),
  // rounded down — CI fails if coverage regresses below today's floor.
  coverageThreshold: {
    global: { statements: 30, branches: 25, functions: 22, lines: 30 },
  },
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/__mocks__/expo-server-sdk.ts',
  },
  testEnvironment: 'node',
};
