/* global describe, it, expect */
import * as fs from 'fs';
import * as path from 'path';

/**
 * M8 invariant: background location is a PROVIDER-only capability. The only
 * place that may request background permission or start the tracker is the
 * background-location service, and the only screen that may call it is the
 * provider's job screen. This fails if a customer flow ever starts asking.
 */
const SRC = path.resolve(__dirname, '../src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(SRC, file);
const filesContaining = (pattern: RegExp) =>
  sourceFiles(SRC)
    .filter((file) => pattern.test(fs.readFileSync(file, 'utf8')))
    .map(rel)
    .sort();

describe('background location stays provider-only (M8)', () => {
  it('only the background-location service requests background permission or starts updates', () => {
    expect(filesContaining(/requestBackgroundPermissionsAsync|startLocationUpdatesAsync/)).toEqual([
      'services/background-location.ts',
    ]);
  });

  it('only the provider job screen starts background sharing', () => {
    expect(filesContaining(/startJobLocationUpdates\(/)).toEqual([
      'app/job/[id].tsx',
      'services/background-location.ts', // the definition
    ]);
  });

  it('no customer screen or request flow imports the tracker', () => {
    const importers = filesContaining(/from '@\/services\/background-location'|services\/background-location'/);
    // root layout (task registration), auth (stop on logout) and the provider job screen.
    expect(importers).toEqual(['app/_layout.tsx', 'app/job/[id].tsx', 'hooks/useAuth.tsx']);
  });
});
