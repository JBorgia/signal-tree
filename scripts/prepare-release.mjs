#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import semver from 'semver';

import { assertReleasePlan } from './release-plan.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const releaseType = process.argv[2] ?? 'patch';
const allowed = new Set(['patch', 'minor', 'major']);
if (!allowed.has(releaseType)) {
  throw new Error(`Expected patch, minor, or major; received ${releaseType}`);
}
const run = (command, args, options = {}) => {
  console.log(`> ${command} ${args.join(' ')}`);
  return execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
    env: process.env,
    ...options,
  });
};
const output = (command, args) =>
  execFileSync(command, args, { cwd: ROOT, encoding: 'utf8' }).trim();

if (output('git', ['status', '--porcelain'])) {
  throw new Error('Release preparation requires a clean working tree');
}
const branch = output('git', ['branch', '--show-current']);
if (!branch) throw new Error('Release preparation requires a named branch');
run('git', ['fetch', 'origin']);
if (output('git', ['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`]) !== '0\t0') {
  throw new Error(`Local ${branch} must exactly match origin/${branch}`);
}

const packages = assertReleasePlan(ROOT);
const manifestPaths = [
  join(ROOT, 'package.json'),
  ...packages.map((name) => join(ROOT, 'packages', name, 'package.json')),
];
const releaseOwnedPaths = [
  ...manifestPaths,
  join(ROOT, 'CHANGELOG.md'),
  join(ROOT, 'apps', 'demo', 'src', 'app', 'version.ts'),
  join(ROOT, 'apps', 'demo', 'src', 'app', 'library-versions.ts'),
];
const releaseOwnedPathspecs = [
  'package.json',
  ...packages.map((name) => `packages/${name}/package.json`),
  'CHANGELOG.md',
  'apps/demo/src/app/version.ts',
  'apps/demo/src/app/library-versions.ts',
];
const originals = new Map(
  releaseOwnedPaths.map((filePath) => [filePath, readFileSync(filePath, 'utf8')])
);
const current = JSON.parse(readFileSync(manifestPaths[0], 'utf8')).version;
const next = semver.inc(current, releaseType);
if (!next) throw new Error(`Cannot derive ${releaseType} version from ${current}`);
if (output('git', ['tag', '--list', `v${next}`])) {
  throw new Error(`Tag v${next} already exists`);
}
try {
  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.version = next;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  run('node', ['tools/generate-version-env.cjs']);
  run('node', [
    'scripts/finalize-changelog.mjs',
    next,
    '--date',
    new Date().toISOString().slice(0, 10),
  ]);
  run('npm', ['run', 'gates', '--', '--release']);
  run('git', ['add', ...releaseOwnedPathspecs]);
  run('git', ['commit', '-m', `chore(release): prepare ${next}`]);
} catch (error) {
  try {
    execFileSync('git', ['restore', '--staged', '--', ...releaseOwnedPathspecs], {
      cwd: ROOT,
      stdio: 'ignore',
    });
  } catch {
    // Preserve the original failure; restoring file bytes below remains useful.
  }
  for (const [filePath, content] of originals) writeFileSync(filePath, content);
  throw error;
}
run('node', ['scripts/publish-candidate.mjs', '--prebuilt', '--prepare-only']);
run('git', ['tag', '-s', `v${next}`, '-m', `Release v${next}`]);
run('git', ['tag', '-v', `v${next}`]);
run('git', ['push', 'origin', branch]);
run('git', ['push', 'origin', `v${next}`]);
console.log(`Prepared and pushed v${next}; tagged CI owns npm publication.`);
