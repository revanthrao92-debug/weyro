const base = require('./jest.config');

/**
 * Config for database-backed e2e tests. Unlike the default config, this does
 * NOT ignore `e2e-*.spec.ts`, and it only runs those files.
 *
 * Requires a live PostgreSQL + PostGIS database (see CI / docker-compose).
 */
module.exports = {
  ...base,
  testPathIgnorePatterns: [],
  testRegex: '.*e2e-.*\\.spec\\.ts$',
};
