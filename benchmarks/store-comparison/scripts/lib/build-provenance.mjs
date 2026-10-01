import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileManifest, sha256 } from './fingerprints.mjs';

export const BUILD_ARGS = [
  'exec',
  'ng',
  'build',
  '--configuration',
  'production',
  '--stats-json',
  '--output-path',
  'dist',
];
export const provenancePath = (root) =>
  join(dirname(root), 'build-provenance.json');

export function captureBuildInputs(appRoot) {
  const files = {};
  for (const name of [
    'package.json',
    'pnpm-lock.yaml',
    'angular.json',
    'tsconfig.json',
    '.browserslistrc',
    '.npmrc',
  ]) {
    const path = join(appRoot, name);
    files[name] = existsSync(path) ? sha256(readFileSync(path)) : null;
  }
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    files,
    source: fileManifest(join(appRoot, 'src')),
    scripts: fileManifest(join(appRoot, 'scripts')),
    // Includes all installed dependencies, nested kernels and pnpm link targets; excludes .cache only.
    installed: fileManifest(join(appRoot, 'node_modules'), {
      installedTree: true,
    }),
  };
}

export function recordBuildProvenance(
  appRoot,
  root,
  before,
  candidateEvidence
) {
  const after = captureBuildInputs(appRoot);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Build inputs changed during build; refusing provenance');
  const servedBuild = fileManifest(root);
  if (!servedBuild?.files.some((file) => file.path === 'index.html'))
    throw new Error('Build did not produce browser/index.html');
  const record = {
    schemaVersion: 1,
    completedAt: new Date().toISOString(),
    command: ['pnpm', ...BUILD_ARGS],
    mode: 'production',
    environment: { NODE_ENV: 'production', NG_BUILD_overrides: 'cleared' },
    inputs: before,
    candidateEvidence,
    servedBuild,
  };
  writeFileSync(provenancePath(root), JSON.stringify(record, null, 2) + '\n', {
    flag: 'wx',
  });
  return record;
}

/** Missing historical receipts stay unknown. A present receipt must match or the run is refused. */
export function verifyBuildProvenance(appRoot, root) {
  const path = provenancePath(root);
  if (!existsSync(path))
    return { status: 'unknown', reason: 'missing build provenance', path };
  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`Invalid build provenance: ${path}`);
  }
  if (
    record.schemaVersion !== 1 ||
    record.mode !== 'production' ||
    JSON.stringify(record.command) !== JSON.stringify(['pnpm', ...BUILD_ARGS])
  )
    throw new Error(`Unsupported build provenance: ${path}`);
  if (
    JSON.stringify(record.inputs) !==
    JSON.stringify(captureBuildInputs(appRoot))
  )
    throw new Error(
      'Stale build provenance: installed packages or build inputs changed; rerun scripts/build-with-provenance.mjs'
    );
  const servedBuild = fileManifest(root);
  if (!servedBuild || servedBuild.sha256 !== record.servedBuild?.sha256)
    throw new Error(
      'Stale build provenance: served bundle bytes changed; rerun scripts/build-with-provenance.mjs'
    );
  return {
    status: 'match',
    path,
    manifestSha256: sha256(readFileSync(path)),
    record,
  };
}
