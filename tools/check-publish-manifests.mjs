#!/usr/bin/env node
/**
 * PUBLISH MANIFESTS — is what we would upload actually installable?
 *
 * `check-publish-artifacts.mjs` asks whether every declared `files` entry
 * resolves. This asks the other half: whether the MANIFEST a consumer reads
 * makes sense off this machine.
 *
 * ## Why this exists
 *
 * Found during the 15.0 release rehearsal. Every internal dependency is written
 * `"@signal-tree/kernel": "workspace:*"`, which is pnpm's workspace protocol and
 * is meaningless to npm, yarn, bun, or a CI runner installing from the
 * registry. Whether it reaches the registry depends on which command someone
 * happens to run:
 *
 *   npm pack   from dist/    ships `workspace:*` SILENTLY
 *   pnpm pack  from dist/    refuses — ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL
 *   nx release version       rewrites `version` only, not the protocol
 *
 * The published 14.1.3 has `"@signal-tree/kernel": "^14.1.3"`, so the real release
 * went through a path that resolved it. That is the problem: the outcome is a
 * property of the operator's muscle memory rather than of the repository. One
 * of the available paths produces a package that cannot be installed, and it is
 * the one that fails quietly.
 *
 * ## What it checks
 *
 * For every publishable package's BUILT manifest:
 *
 *   1. no `workspace:`, `file:`, `link:` or `portal:` specifier in
 *      dependencies / peerDependencies / optionalDependencies
 *   2. every internal `@signaltree/*` range is satisfied by the version that
 *      package is being published at — a range that admits nothing is the same
 *      defect wearing a valid-looking string
 *   3. not `private: true` — an unpublishable package in the publish set
 *   4. `main`, `module` and `types` point inside the package rather than at a
 *      source path that only exists in this repo
 *
 * Usage:
 *   node tools/check-publish-manifests.mjs [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The fixed release group — the projects `build:all` produces and we publish. */
const PUBLISHABLE = ['core'];

const BAD_PROTOCOLS = ['workspace:', 'file:', 'link:', 'portal:'];
const DEP_BLOCKS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];


/**
 * Minimal semver satisfaction, prerelease-aware, no dependency.
 *
 * Deliberately NOT the `semver` package: this tool decides whether a release
 * may go out, and a release gate that cannot run until `node_modules` is
 * correct is a gate that is off exactly when it matters. Handles what internal
 * ranges actually use — exact, `^`, `~`, `>=`, and `||` alternatives — and
 * reports an unrecognised range as a problem rather than passing it.
 */
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(value.trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split('.') : [],
  };
}

function compare(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  // A version with a prerelease is LOWER than the same without one.
  if (a.pre.length === 0 && b.pre.length === 0) return 0;
  if (a.pre.length === 0) return 1;
  if (b.pre.length === 0) return -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) < Number(y) ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** @returns true | false | 'unparsable' */
function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) return 'unparsable';
  for (const alternative of range.split('||')) {
    const clause = alternative.trim();
    const operator = /^(\^|~|>=|>|<=|<|=)?\s*(.+)$/.exec(clause);
    if (!operator) return 'unparsable';
    const bound = parseVersion(operator[2]);
    if (!bound) return 'unparsable';
    const cmp = compare(v, bound);
    switch (operator[1] ?? '=') {
      case '=':
        if (cmp === 0) return true;
        break;
      case '>=':
        if (cmp >= 0) return true;
        break;
      case '>':
        if (cmp > 0) return true;
        break;
      case '<=':
        if (cmp <= 0) return true;
        break;
      case '<':
        if (cmp < 0) return true;
        break;
      case '~':
        if (cmp >= 0 && v.major === bound.major && v.minor === bound.minor) {
          return true;
        }
        break;
      case '^': {
        if (cmp < 0) break;
        const sameLeadingNonZero =
          bound.major !== 0
            ? v.major === bound.major
            : bound.minor !== 0
              ? v.major === 0 && v.minor === bound.minor
              : v.major === 0 && v.minor === 0 && v.patch === bound.patch;
        if (sameLeadingNonZero) return true;
        break;
      }
      default:
        return 'unparsable';
    }
  }
  return false;
}

/**
 * The whole dependency verdict for one manifest.
 *
 * Shared with `--self-test` DELIBERATELY. The first version duplicated this
 * loop inside the self-test, which meant the fixtures could pass while the real
 * checker was broken — and the gate registered blind twice before that was the
 * diagnosis. A self-test that does not execute the code it certifies is a
 * second implementation, not a test.
 */
function inspectManifest(json, path, versionByName) {
  const found = [];

  if (json.private === true) {
    found.push(
      `${path}: private:true, but it is in the publish set. Either drop it from PUBLISHABLE or make it publishable.`
    );
  }

  for (const block of DEP_BLOCKS) {
    for (const [dep, range] of Object.entries(json[block] ?? {})) {
      if (typeof range !== 'string') continue;

      const protocol = BAD_PROTOCOLS.find((p) => range.startsWith(p));
      if (protocol) {
        found.push(
          `${path}: ${block}["${dep}"] = "${range}" — the \`${protocol}\` protocol ` +
            `does not resolve off this machine. A consumer installing from the ` +
            `registry cannot satisfy it.`
        );
        continue;
      }

      const internalVersion = versionByName.get(dep);
      if (internalVersion === undefined) continue;
      const admitted = satisfies(internalVersion, range);
      if (admitted === 'unparsable') {
        found.push(
          `${path}: ${block}["${dep}"] = "${range}" is not a range this checker ` +
            `recognises. Widen the checker deliberately rather than assuming it is fine.`
        );
        continue;
      }
      if (!admitted) {
        found.push(
          `${path}: ${block}["${dep}"] = "${range}" does not admit ${dep}@${internalVersion}, ` +
            `which is the version being published alongside it. Installing both ` +
            `is impossible.`
        );
      }
    }
  }

  return found;
}

/**
 * Fixture self-test.
 *
 * A checker on a repository that is already clean cannot prove itself by
 * blinding its own condition — there is nothing left for the condition to
 * catch, so the mutation passes and the gate registers BLIND. That happened
 * here on the first attempt. Fixtures are the way: they are the defects this
 * exists to stop, kept where they can be re-run.
 */
function selfTest() {
  const clean = {
    name: '@signaltree/events',
    version: '15.0.0-rc.1',
    peerDependencies: { '@signal-tree/kernel': '^15.0.0-rc.1' },
  };
  const withProtocol = {
    name: '@signaltree/events',
    version: '15.0.0-rc.1',
    // The exact string the 15.0 rehearsal found in dist/.
    peerDependencies: { '@signal-tree/kernel': 'workspace:*' },
  };
  const withDeadRange = {
    name: '@signaltree/events',
    version: '15.0.0-rc.1',
    // Valid semver, admits nothing being shipped — a caret on a stable version
    // does NOT admit a prerelease of the same version.
    peerDependencies: { '@signal-tree/kernel': '^15.0.0' },
  };

  const versions = new Map([['@signal-tree/kernel', '15.0.0-rc.1']]);
  const check = (manifest) => inspectManifest(manifest, '<fixture>', versions);

  const failures = [];
  if (check(clean).length > 0) {
    failures.push('rejected a clean manifest');
  }
  if (check(withProtocol).length === 0) {
    failures.push('accepted `workspace:*` in peerDependencies');
  }
  if (check(withDeadRange).length === 0) {
    failures.push('accepted `^15.0.0` alongside a 15.0.0-rc.1 release');
  }
  // And the comparator itself, since every range verdict rests on it.
  if (satisfies('15.0.0-rc.1', '^15.0.0-rc.1') !== true) {
    failures.push('^15.0.0-rc.1 must admit 15.0.0-rc.1');
  }
  if (satisfies('15.0.0', '^15.0.0-rc.1') !== true) {
    failures.push('^15.0.0-rc.1 must admit the eventual 15.0.0');
  }
  if (satisfies('15.0.0-rc.2', '^15.0.0-rc.1') !== true) {
    failures.push('^15.0.0-rc.1 must admit a later prerelease');
  }
  if (satisfies('16.0.0', '^15.0.0-rc.1') !== false) {
    failures.push('^15.0.0-rc.1 must not admit 16.0.0');
  }
  if (satisfies('14.1.3', '^15.0.0-rc.1') !== false) {
    failures.push('^15.0.0-rc.1 must not admit 14.1.3');
  }

  if (failures.length > 0) {
    console.error('❌ publish-manifest checker self-test FAILED');
    for (const failure of failures) console.error(`   - ${failure}`);
    process.exit(1);
  }
  console.log(
    '✅ the manifest checker rejects `workspace:*` and a range that admits nothing,\n' +
      '   accepts a clean manifest, and its comparator handles prerelease ranges'
  );
  process.exit(0);
}

if (process.argv.includes('--self-test')) {
  selfTest();
}

const problems = [];
const manifests = new Map();

for (const project of PUBLISHABLE) {
  const path = join(process.cwd(), 'dist/packages', project, 'package.json');
  if (!existsSync(path)) {
    problems.push(
      `${project}: no built manifest at dist/packages/${project}/package.json — run \`npm run build:all\``
    );
    continue;
  }
  manifests.set(project, {
    path: `dist/packages/${project}/package.json`,
    json: JSON.parse(readFileSync(path, 'utf8')),
  });
}

// name -> version, for the internal-range check.
const versionByName = new Map();
for (const { json } of manifests.values()) {
  if (json.name && json.version) {
    versionByName.set(json.name, json.version);
  }
}

for (const [project, { path, json }] of manifests) {
  problems.push(...inspectManifest(json, path, versionByName));

  for (const field of ['main', 'module', 'types', 'typings']) {
    const value = json[field];
    if (typeof value !== 'string') continue;
    if (value.startsWith('../') || value.startsWith('/')) {
      problems.push(
        `${path}: "${field}" = "${value}" points outside the package.`
      );
      continue;
    }
    const resolved = join(
      process.cwd(),
      'dist/packages',
      project,
      value.replace(/^\.\//, '')
    );
    if (!existsSync(resolved)) {
      problems.push(
        `${path}: "${field}" = "${value}" does not exist in the built package.`
      );
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ problems }, null, 2));
}

if (problems.length > 0) {
  console.error(
    `❌ ${problems.length} problem(s) in what would be published:\n`
  );
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    '\nA manifest defect does not fail any build, any test, or any import in ' +
      'this\nrepository. It fails once, for every consumer, after publish.'
  );
  process.exit(1);
}

console.log(
  `✅ ${manifests.size} built manifest(s) are installable off this machine: no ` +
    `workspace/file/link\n   protocols, internal ranges admit the versions ` +
    `shipping beside them, entry points resolve.`
);
