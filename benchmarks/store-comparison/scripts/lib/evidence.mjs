import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { fileManifest, sha256 } from './fingerprints.mjs';
export { fileManifest } from './fingerprints.mjs';
import { compareInstalledTarball } from './source-provenance.mjs';
import { verifyBuildProvenance } from './build-provenance.mjs';

export function candidateEvidence(appRoot, alias) {
  const root = join(appRoot, 'node_modules', alias);
  const path = join(root, '.candidate.json');
  let claimed = null;
  let manifestStatus = 'missing';
  if (existsSync(path)) {
    try {
      claimed = JSON.parse(readFileSync(path, 'utf8'));
      manifestStatus =
        claimed && typeof claimed === 'object' ? 'present' : 'invalid';
    } catch {
      manifestStatus = 'invalid';
    }
  }
  const tarballs = {};
  for (const name of ['angular', 'kernel']) {
    const record = claimed?.[name];
    if (
      typeof record?.tarball !== 'string' ||
      !/^[a-f0-9]{64}$/.test(record?.sha256 ?? '')
    ) {
      tarballs[name] = { status: 'unknown' };
    } else if (!existsSync(record.tarball)) {
      tarballs[name] = { status: 'unavailable' };
    } else {
      const observedSha256 = sha256(readFileSync(record.tarball));
      tarballs[name] = {
        status: observedSha256 === record.sha256 ? 'match' : 'mismatch',
        observedSha256,
      };
    }
  }
  const payloads = Object.fromEntries(
    ['angular', 'kernel'].map((name) => [
      name,
      tarballs[name].status === 'match'
        ? compareInstalledTarball(
            appRoot,
            name === 'angular'
              ? root
              : join(root, 'node_modules', '@signal-tree', 'kernel'),
            claimed[name].tarball
          )
        : {
            status:
              tarballs[name].status === 'mismatch' ? 'mismatch' : 'unknown',
          },
    ])
  );
  const statuses = Object.values(payloads).map((value) => value.status);
  return {
    payloads,
    manifestStatus,
    claimed,
    tarballs,
    installedAngular: fileManifest(root),
    installedKernel: fileManifest(
      join(root, 'node_modules', '@signal-tree', 'kernel')
    ),
    claimedSourceCommit: /^[a-f0-9]{40}$/.test(
      claimed?.source?.claimedCommit ?? ''
    )
      ? claimed.source.claimedCommit
      : 'unknown',
    sourceCommit: 'unknown', // A sidecar claim is not a verified source-to-tarball build.
    installedMatchesTarballs: statuses.includes('mismatch')
      ? false
      : statuses.every((status) => status === 'match')
      ? true
      : 'unknown',
  };
}

export function collectEvidence(appRoot, root = null) {
  const inputs = {};
  for (const name of [
    'package.json',
    'pnpm-lock.yaml',
    'angular.json',
    'tsconfig.json',
  ]) {
    const path = join(appRoot, name);
    inputs[name] = existsSync(path) ? sha256(readFileSync(path)) : null;
  }
  const buildProvenance = root
    ? verifyBuildProvenance(appRoot, resolve(root))
    : null;
  return {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    inputs,
    harness: fileManifest(join(appRoot, 'scripts')),
    source: fileManifest(join(appRoot, 'src')),
    sizeFixtures: fileManifest(join(appRoot, 'size')),
    servedBuild: root ? fileManifest(resolve(root)) : null,
    buildProvenance,
    servedBuildMatchesInstalledPackages:
      buildProvenance?.status === 'match' ? true : 'unknown',
    candidates: Object.fromEntries(
      ['st15-candidate', 'st15-candidate-enhanced'].map((alias) => [
        alias,
        candidateEvidence(appRoot, alias),
      ])
    ),
  };
}

export function developmentReasons(opts, environment) {
  return [
    opts.quick && 'quick sampling',
    opts.rounds < 5 && 'fewer than five rounds',
    environment.busy && 'busy at start',
    environment.endBusy && 'busy at end',
    environment.customRoot && 'custom build root',
  ].filter(Boolean);
}

/** Net change includes categories which shrank or disappeared; positive growth is separate. */
export function diffHeapCategories(before, after) {
  const categories = [...new Set([...before.keys(), ...after.keys()])]
    .map((key) => [
      key,
      (after.get(key)?.[0] ?? 0) - (before.get(key)?.[0] ?? 0),
      (after.get(key)?.[1] ?? 0) - (before.get(key)?.[1] ?? 0),
    ])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return {
    categories,
    netBytes: categories.reduce((sum, [, bytes]) => sum + bytes, 0),
    positiveBytes: categories.reduce(
      (sum, [, bytes]) => sum + Math.max(0, bytes),
      0
    ),
  };
}
