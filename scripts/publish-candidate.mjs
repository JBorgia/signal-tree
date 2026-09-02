#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import semver from 'semver';

import { assertReleasePlan } from './release-plan.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const prebuilt = args.has('--prebuilt');
const ci = args.has('--ci');
const prepareOnly = args.has('--prepare-only');
const packages = assertReleasePlan(ROOT);
const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = semver.valid(rootManifest.version);
if (!version) throw new Error(`Invalid workspace version: ${rootManifest.version}`);
const prerelease = semver.prerelease(version);
const tag = prerelease ? String(prerelease[0]) : 'latest';
const candidateRoot = join(ROOT, '.release', 'candidates', version);
const tarballRoot = join(candidateRoot, 'tarballs');
const journalPath = join(candidateRoot, 'candidate.json');

const run = (command, commandArgs, options = {}) => {
  console.log(`> ${command} ${commandArgs.join(' ')}`);
  execFileSync(command, commandArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
};

if (!prebuilt) {
  run('pnpm', [
    'nx',
    'run-many',
    '-t',
    'build',
    `--projects=${packages.join(',')}`,
    '--configuration=production',
    '--parallel=1',
  ]);
}

run('node', ['scripts/prepare-publish-artifacts.mjs']);
run('node', ['scripts/resolve-workspace-specs.mjs', version, ...packages]);
run('node', ['scripts/verify-publish-artifacts.mjs', ...packages]);
run('node', ['scripts/verify-package-hygiene.js']);
run('node', ['scripts/verify-jsdoc-stripping.js']);
run('node', ['tools/check-declaration-docs.mjs']);
run('node', ['tools/verify-tarball-consumer.mjs']);

rmSync(candidateRoot, { recursive: true, force: true });
mkdirSync(tarballRoot, { recursive: true });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const artifacts = [];
for (const name of packages) {
  const distRoot = join(ROOT, 'dist', 'packages', name);
  const manifest = JSON.parse(readFileSync(join(distRoot, 'package.json'), 'utf8'));
  if (manifest.version !== version) {
    throw new Error(`${manifest.name} is ${manifest.version}; expected ${version}`);
  }
  const packed = JSON.parse(
    execFileSync(
      'npm',
      ['pack', distRoot, '--json', '--pack-destination', tarballRoot],
      { cwd: ROOT, encoding: 'utf8' }
    )
  )[0];
  const tarball = join(tarballRoot, packed.filename);
  const integrity = `sha512-${createHash('sha512')
    .update(readFileSync(tarball))
    .digest('base64')}`;
  artifacts.push({
    name: manifest.name,
    package: name,
    version,
    tarball: `tarballs/${basename(tarball)}`,
    integrity,
  });
}
const candidate = {
  schemaVersion: 1,
  commit,
  version,
  tag,
  packages: artifacts,
  state: 'validated',
};
writeFileSync(journalPath, `${JSON.stringify(candidate, null, 2)}\n`);
console.log(`Validated immutable candidate: ${journalPath}`);
run('node', [
  'tools/verify-consumer-typecheck.mjs',
  ...artifacts.map(
    (artifact) => `--tarball=${join(candidateRoot, artifact.tarball)}`
  ),
]);
run('node', ['scripts/verify-publish-candidate.mjs']);

if (prepareOnly) process.exit(0);

let userconfig;
try {
  if (process.env.NPM_TOKEN) {
    userconfig = join(candidateRoot, '.npmrc');
    writeFileSync(
      userconfig,
      `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`,
      { mode: 0o600 }
    );
  } else if (!ci && !dryRun) {
    run('npm', ['whoami']);
  } else if (ci && !process.env.GITHUB_ACTIONS && !dryRun) {
    throw new Error('--ci publishing requires GitHub Actions trusted publishing');
  }

  candidate.state = dryRun ? 'dry-run' : 'publishing';
  writeFileSync(journalPath, `${JSON.stringify(candidate, null, 2)}\n`);
  for (const artifact of artifacts) {
    const tarball = join(candidateRoot, artifact.tarball);
    const currentIntegrity = `sha512-${createHash('sha512')
      .update(readFileSync(tarball))
      .digest('base64')}`;
    if (currentIntegrity !== artifact.integrity) {
      throw new Error(`Candidate tarball changed after validation: ${artifact.name}`);
    }
    if (!dryRun) {
      const existing = spawnSync(
        'npm',
        ['view', `${artifact.name}@${version}`, 'dist.integrity', '--json'],
        { cwd: ROOT, encoding: 'utf8' }
      );
      if (existing.status === 0) {
        const registryIntegrity = JSON.parse(existing.stdout || 'null');
        if (registryIntegrity !== artifact.integrity) {
          throw new Error(
            `${artifact.name}@${version} already exists with different integrity`
          );
        }
        console.log(`Skipping identical ${artifact.name}@${version}`);
        continue;
      }
      const lookupError = `${existing.stdout ?? ''}${existing.stderr ?? ''}`;
      if (!/E404|404 Not Found/i.test(lookupError)) {
        throw new Error(
          `Could not determine registry state for ${artifact.name}@${version}: ${lookupError.trim()}`
        );
      }
    }
    const publishArgs = ['publish', tarball, '--access', 'public', '--tag', tag];
    if (dryRun) publishArgs.push('--dry-run');
    if (userconfig) publishArgs.push('--userconfig', userconfig);
    if (ci || process.env.NPM_CONFIG_PROVENANCE === 'true') {
      publishArgs.push('--provenance');
    }
    run('npm', publishArgs);
  }
  candidate.state = dryRun ? 'dry-run-complete' : 'published';
  writeFileSync(journalPath, `${JSON.stringify(candidate, null, 2)}\n`);
  console.log(`${dryRun ? 'Dry run' : 'Publish'} complete for ${version} (${tag}).`);
} finally {
  if (userconfig) rmSync(userconfig, { force: true });
}
