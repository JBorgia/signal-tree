#!/usr/bin/env node
/**
 * ARTIFACT-LEVEL PROVENANCE FOR A CPU CANDIDATE.
 *
 * A branch name is not provenance. This program's whole validation problem was
 * that published numbers could not be traced to a buildable artifact: the
 * commits under test did not compile, and the measured `dist` came from
 * uncommitted working-tree source. A manifest makes that class of drift
 * detectable rather than arguable.
 *
 * Records the candidate commit, the common parent it was derived from, the
 * exact files differing from the reference candidate, the Node version, the
 * lockfile hash, and a content hash of each built package tree. If a quiet-host
 * run reports a number, the manifest says precisely what produced it.
 *
 *   node tools/cpu-candidate-manifest.mjs \
 *     --worktree /tmp/cand/token-epoch --dist /tmp/cand-dist/token-epoch \
 *     --reference cpu/token-epoch --out manifest.json
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const arg = (n, f) => { const i = process.argv.indexOf(n); return i === -1 ? f : process.argv[i + 1]; };
const WORKTREE = resolve(arg('--worktree', '.'));
const DIST = arg('--dist', '') ? resolve(arg('--dist', '')) : '';
const REFERENCE = arg('--reference', 'cpu/token-epoch');
const OUT = arg('--out', '');

const git = (...args) =>
  execFileSync('git', args, { cwd: WORKTREE, encoding: 'utf8' }).trim();

/** Deterministic: sorted relative paths, each path and its bytes hashed in. */
function hashTree(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(root);
  const h = createHash('sha256');
  for (const f of files.sort()) {
    h.update(relative(root, f));
    h.update(readFileSync(f));
  }
  return { sha256: h.digest('hex'), fileCount: files.length };
}

const commit = git('rev-parse', 'HEAD');
const parent = git('merge-base', 'HEAD', REFERENCE);
const differing = git('diff', '--name-only', `${REFERENCE}`, 'HEAD')
  .split('\n')
  .filter(Boolean);

const manifest = {
  candidate: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit,
  commitSubject: git('log', '-1', '--format=%s'),
  derivedFrom: { reference: REFERENCE, commonParent: parent },
  // The decision claim is that ONLY the physical realization differs. This is
  // the field that falsifies it if something else crept in.
  filesDifferingFromReference: differing,
  dirtyFiles: git('status', '--porcelain').split('\n').filter(Boolean).length,
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  lockfile: (() => {
    for (const name of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
      try {
        return {
          name,
          sha256: createHash('sha256').update(readFileSync(join(WORKTREE, name))).digest('hex'),
        };
      } catch { /* try the next one */ }
    }
    return null;
  })(),
  dist: DIST
    ? Object.fromEntries(
        readdirSync(DIST).sort().map((pkg) => [pkg, hashTree(join(DIST, pkg))])
      )
    : null,
  generatedAt: new Date().toISOString(),
};

const text = JSON.stringify(manifest, null, 2);
if (OUT) { writeFileSync(OUT, text + '\n'); console.error(`wrote ${OUT}`); }
console.log(text);
