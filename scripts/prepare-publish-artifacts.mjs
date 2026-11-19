#!/usr/bin/env node
/**
 * Verify that the package build emitted everything its tarball declares.
 *
 * The Rollup build owns the final publishable layout. This verifier deliberately
 * performs no post-build copying: a missing asset is a build failure, not a
 * condition that a later release script may repair differently.
 *
 * Usage:
 *   node scripts/prepare-publish-artifacts.mjs
 *   node scripts/prepare-publish-artifacts.mjs --verify-only
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((pkg) => {
    const manifest = join(ROOT, 'packages', pkg, 'package.json');
    return (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, 'utf8')).private !== true
    );
  })
  .sort();

function run(label, argv) {
  process.stdout.write(`  · ${label} ... `);
  try {
    execFileSync(argv[0], argv.slice(1), { cwd: ROOT, stdio: 'pipe' });
    console.log('ok');
  } catch (err) {
    console.log('FAILED');
    console.error(String(err.stdout ?? '') + String(err.stderr ?? err.message));
    process.exit(1);
  }
}

if (!existsSync(join(ROOT, 'dist/packages/kernel'))) {
  console.error(
    '✗ dist/packages/kernel is missing — run `npm run build:all` first.\n' +
      '  This script prepares a build; it does not produce one.'
  );
  process.exit(1);
}

console.log('\nVerifying every declared `files` entry resolves\n');
run('verify-publish-artifacts', [
  'node',
  'scripts/verify-publish-artifacts.mjs',
  ...PACKAGES,
]);

console.log('\n✅ Tarball contents are complete and verified.');
