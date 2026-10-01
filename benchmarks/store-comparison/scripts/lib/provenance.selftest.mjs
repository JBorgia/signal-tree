import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  readSourceIdentity,
  compareInstalledTarball,
} from './source-provenance.mjs';
import {
  captureBuildInputs,
  recordBuildProvenance,
  verifyBuildProvenance,
} from './build-provenance.mjs';
import { candidateEvidence } from './evidence.mjs';
import { sha256 } from './fingerprints.mjs';

function workspace(t) {
  const dir = mkdtempSync(join(import.meta.dirname, '.provenance-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function buildFixture(t) {
  const dir = workspace(t);
  for (const path of ['scripts', 'src', 'node_modules/example', 'dist/browser'])
    mkdirSync(join(dir, path), { recursive: true });
  writeFileSync(
    join(dir, 'node_modules/example/index.js'),
    'installed original'
  );
  writeFileSync(join(dir, 'src/main.ts'), 'source original');
  writeFileSync(
    join(dir, 'dist/browser/index.html'),
    '<script src="main.js"></script>'
  );
  writeFileSync(join(dir, 'dist/browser/main.js'), 'bundle original');
  return { dir, root: join(dir, 'dist/browser') };
}

test('source sidecars keep absent/invalid/conflicting claims unknown', (t) => {
  const dir = workspace(t);
  assert.equal(readSourceIdentity(dir).claimedCommit, 'unknown');
  writeFileSync(join(dir, 'source-commit.txt'), 'a'.repeat(40) + '\n');
  assert.equal(readSourceIdentity(dir).claimedCommit, 'a'.repeat(40));
  assert.equal(readSourceIdentity(dir).verification, 'unverified');
  writeFileSync(
    join(dir, 'source-manifest.json'),
    JSON.stringify({ sourceCommit: 'b'.repeat(40) })
  );
  assert.equal(readSourceIdentity(dir).claimedCommit, 'unknown');
  writeFileSync(join(dir, 'source-manifest.json'), '{broken');
  assert.equal(readSourceIdentity(dir).claimedCommit, 'unknown');
});

test('valid JSON source manifest alone records the claim and sidecar checksum', (t) => {
  const dir = workspace(t);
  const bytes = JSON.stringify({ sourceCommit: 'c'.repeat(40) });
  writeFileSync(join(dir, 'source-manifest.json'), bytes);
  const source = readSourceIdentity(dir);
  assert.equal(source.claimedCommit, 'c'.repeat(40));
  assert.equal(source.records[0].sha256, sha256(bytes));
});

test('extracted tarball comparison detects changed installed bytes despite unchanged version', (t) => {
  const dir = workspace(t);
  const packed = join(dir, 'packed/package');
  const installed = join(dir, 'node_modules/st15-candidate');
  mkdirSync(packed, { recursive: true });
  mkdirSync(installed, { recursive: true });
  for (const root of [packed, installed]) {
    writeFileSync(join(root, 'package.json'), '{"version":"15.4.0"}');
    writeFileSync(join(root, 'index.js'), 'original');
  }
  const tarball = join(dir, 'package.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', join(dir, 'packed'), 'package']);
  writeFileSync(join(installed, '.candidate.json'), '{}');
  assert.equal(
    compareInstalledTarball(dir, installed, tarball).status,
    'match'
  );
  writeFileSync(join(installed, 'index.js'), 'modified');
  assert.equal(
    compareInstalledTarball(dir, installed, tarball).status,
    'mismatch'
  );
  writeFileSync(
    join(installed, '.candidate.json'),
    JSON.stringify({
      angular: { tarball, sha256: sha256(readFileSync(tarball)) },
      source: { claimedCommit: 'd'.repeat(40) },
    })
  );
  const evidence = candidateEvidence(dir, 'st15-candidate');
  assert.equal(evidence.installedMatchesTarballs, false);
  assert.equal(evidence.claimedSourceCommit, 'd'.repeat(40));
  assert.equal(evidence.sourceCommit, 'unknown');
});

test('receipt matches unchanged inputs but refuses changed installed bytes and bundle bytes', (t) => {
  const { dir, root } = buildFixture(t);
  assert.equal(verifyBuildProvenance(dir, root).status, 'unknown');
  recordBuildProvenance(dir, root, captureBuildInputs(dir), {});
  assert.equal(verifyBuildProvenance(dir, root).status, 'match');
  writeFileSync(
    join(dir, 'node_modules/example/index.js'),
    'installed altered'
  );
  assert.throws(
    () => verifyBuildProvenance(dir, root),
    /installed packages or build inputs changed/
  );
  writeFileSync(
    join(dir, 'node_modules/example/index.js'),
    'installed original'
  );
  writeFileSync(join(root, 'main.js'), 'bundle altered');
  assert.throws(
    () => verifyBuildProvenance(dir, root),
    /served bundle bytes changed/
  );
});

test('inputs changing during a build refuse a receipt', (t) => {
  const { dir, root } = buildFixture(t);
  const before = captureBuildInputs(dir);
  writeFileSync(join(dir, 'src/main.ts'), 'changed during build');
  assert.throws(
    () => recordBuildProvenance(dir, root, before, {}),
    /inputs changed during build/
  );
  assert.equal(verifyBuildProvenance(dir, root).status, 'unknown');
});

test('installed fingerprint follows pnpm-style targets and handles directory cycles', (t) => {
  const { dir, root } = buildFixture(t);
  const target = join(dir, 'store/example');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'index.js'), 'original target');
  symlinkSync(target, join(dir, 'node_modules/alias'));
  symlinkSync(join(dir, 'node_modules'), join(target, 'node_modules'));
  recordBuildProvenance(dir, root, captureBuildInputs(dir), {});
  assert.equal(verifyBuildProvenance(dir, root).status, 'match');
  writeFileSync(join(target, 'index.js'), 'modified target');
  assert.throws(
    () => verifyBuildProvenance(dir, root),
    /installed packages or build inputs changed/
  );
});
