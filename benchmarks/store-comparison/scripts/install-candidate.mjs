#!/usr/bin/env node
/**
 * Install an unreleased SignalTree build as the `st15-candidate` arm.
 *
 * Usage: node scripts/install-candidate.mjs <dir containing signal-tree-angular-*.tgz and signal-tree-kernel-*.tgz>
 *
 * The packed tarballs are what a consumer would install, so the candidate is measured as an
 * installed artifact, never from workspace source. The Angular package lands at
 * node_modules/st15-candidate with its own kernel nested beneath it, so it cannot pick up the
 * released kernel that `st15-released` uses. `@angular/core` and `tslib` resolve upward to this
 * app's single copies, the same instances every other arm uses.
 *
 * `pnpm install` prunes this directory; rerun after installing. The runner refuses to start
 * without it, and records the tarball checksums it was given.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error(
    'usage: node scripts/install-candidate.mjs <dir with signal-tree-{angular,kernel}-*.tgz>'
  );
  process.exit(2);
}
const dir = resolve(source);
const find = (name) => {
  const matches = readdirSync(dir).filter(
    (file) => file.startsWith(`signal-tree-${name}-`) && file.endsWith('.tgz')
  );
  if (matches.length !== 1)
    throw new Error(
      `expected exactly one signal-tree-${name}-*.tgz in ${dir}, found ${matches.length}`
    );
  return join(dir, matches[0]);
};
const tarballs = { angular: find('angular'), kernel: find('kernel') };
// Installed twice from the same tarballs. `st15-candidate-enhanced` is a separate module graph
// for the arm that installs transactions()/restoration(): importing one package from two lazy
// routes makes the bundler share its chunk, so the plain candidate route would load (and be
// measured with) enhancer code it never uses.
const ALIASES = ['st15-candidate', 'st15-candidate-enhanced'];
const rootOf = (alias) => join(process.cwd(), 'node_modules', alias);
const kernelOf = (alias) =>
  join(rootOf(alias), 'node_modules', '@signal-tree', 'kernel');
for (const alias of ALIASES) {
  rmSync(rootOf(alias), { recursive: true, force: true });
  for (const [target, tarball] of [
    [rootOf(alias), tarballs.angular],
    [kernelOf(alias), tarballs.kernel],
  ]) {
    mkdirSync(target, { recursive: true });
    // npm tarballs hold one top-level `package/` directory.
    execFileSync('tar', [
      '-xzf',
      tarball,
      '-C',
      target,
      '--strip-components=1',
    ]);
  }
}
const root = rootOf(ALIASES[0]);
const kernel = kernelOf(ALIASES[0]);
const version = (path) =>
  JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')).version;
const angularVersion = version(root);
const kernelVersion = version(kernel);
const wanted = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  .dependencies?.['@signal-tree/kernel'];
if (wanted !== kernelVersion)
  throw new Error(
    `candidate angular ${angularVersion} wants kernel ${wanted}, tarball is ${kernelVersion}`
  );
if (!existsSync(join(process.cwd(), 'node_modules', '@angular', 'core')))
  throw new Error('run pnpm install --ignore-workspace first');
const sha256 = (file) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const record = {
  angular: {
    version: angularVersion,
    tarball: tarballs.angular,
    sha256: sha256(tarballs.angular),
  },
  kernel: {
    version: kernelVersion,
    tarball: tarballs.kernel,
    sha256: sha256(tarballs.kernel),
  },
};
for (const alias of ALIASES)
  writeFileSync(
    join(rootOf(alias), '.candidate.json'),
    JSON.stringify(record, null, 2) + '\n'
  );
console.log(
  `${ALIASES.join(
    ', '
  )}: @signal-tree/angular ${angularVersion} + kernel ${kernelVersion}`
);
