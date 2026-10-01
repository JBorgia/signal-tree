import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileManifest, sha256 } from './fingerprints.mjs';

/** A valid SHA is a claim, never proof that a tarball was built from that commit. */
export function readSourceIdentity(dir) {
  const records = [];
  for (const name of ['source-commit.txt', 'source-manifest.json']) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    const bytes = readFileSync(path);
    let commit;
    try {
      commit = name.endsWith('.txt')
        ? bytes.toString().trim()
        : JSON.parse(bytes).sourceCommit;
    } catch {}
    const valid =
      typeof commit === 'string' && /^[a-fA-F0-9]{40}$/.test(commit);
    records.push({
      path,
      sha256: sha256(bytes),
      claimedCommit: valid ? commit.toLowerCase() : 'unknown',
    });
  }
  const claims = new Set(records.map((r) => r.claimedCommit));
  const claimedCommit =
    claims.size === 1 && !claims.has('unknown') ? [...claims][0] : 'unknown';
  return {
    claimedCommit,
    verification: 'unverified',
    status: !records.length
      ? 'missing'
      : claimedCommit === 'unknown'
      ? 'invalid-or-conflicting'
      : 'claimed',
    records,
  };
}

/** Compare extracted payload bytes, excluding only installed metadata and dependency folders. */
export function compareInstalledTarball(appRoot, installedRoot, tarball) {
  if (!existsSync(installedRoot) || !existsSync(tarball))
    return { status: 'unknown' };
  const temporaryRoot = join(appRoot, 'results');
  mkdirSync(temporaryRoot, { recursive: true });
  const temp = mkdtempSync(join(temporaryRoot, '.tarball-check-'));
  const tar = (args) =>
    execFileSync('tar', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  try {
    // Reject traversal and links before extracting; only regular npm package trees are supported.
    const names = tar(['-tzf', tarball]).trim().split('\n');
    if (
      names.some(
        (name) => !name.startsWith('package/') || name.split('/').includes('..')
      )
    )
      throw new Error('unsupported archive paths');
    if (
      tar(['-tvzf', tarball])
        .trim()
        .split('\n')
        .some((line) => !['-', 'd'].includes(line[0]))
    )
      throw new Error('archive contains links or non-regular entries');
    tar(['-xzf', tarball, '-C', temp]);
    const packed = fileManifest(join(temp, 'package'));
    const installed = fileManifest(installedRoot, {
      ignoreRoot: ['.candidate.json'],
    });
    if (!packed || !installed) return { status: 'unknown' };
    return {
      status: packed.sha256 === installed.sha256 ? 'match' : 'mismatch',
      packedPayloadSha256: packed.sha256,
      installedPayloadSha256: installed.sha256,
    };
  } catch (error) {
    return { status: 'unknown', error: String(error.message) };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
