#!/usr/bin/env node
/**
 * A HISTORICAL A/B MUST BE PROVEN TO BE COMPARING TWO DIFFERENT BUILDS.
 *
 * ## Why this exists
 *
 * `NX_WORKSPACE_ROOT_PATH` is set in this repo's development environment, to the
 * main checkout. Every `nx` invocation honours it regardless of the working
 * directory — so a build launched from a git worktree, or from a fully detached
 * `git archive` extract with its own `node_modules`, silently compiles the MAIN
 * tree's source into the MAIN tree's `dist`. Two things follow, both bad:
 *
 *   1. the "historical" artifact is actually HEAD, so the A/B compares HEAD with
 *      itself and reports a ratio of 1.0 — or worse, a plausible small number;
 *   2. the main `dist` is overwritten, so a measurement running against it is
 *      silently reading a different commit than the operator believes.
 *
 * Both happened while attributing the `setAll` regression. The first bisect
 * attempt was abandoned after the second symptom was noticed by accident; the
 * A/B was only caught because the two captured artifacts turned out
 * byte-identical. "I diffed the artifacts" is the only reason a wrong 41x
 * did not get written down.
 *
 * So this is a gate rather than a paragraph in an audit: the isolation claim is
 * mechanically checkable, and a claim that is only ever checked by remembering
 * to check it is the failure class this repo keeps rediscovering.
 *
 * ## What it asserts
 *
 * Given two built barrels, that they are DIFFERENT builds — not merely two
 * paths. Plus, when a marker file is named, that exactly one side has it, which
 * catches the specific case where both paths were produced from the same source
 * at different times.
 *
 * Usage:
 *   node tools/check-historical-ab-isolation.mjs --old <barrel> --new <barrel> \
 *     [--marker lib/internals/production-substrate-stats.js] [--expect-marker new]
 *   node tools/check-historical-ab-isolation.mjs --self-test
 *
 * ## What it does NOT prove
 *
 * This is NOT full proof of a historical comparison. It refuses the specific
 * failure that happened here — two arms that are secretly one build — and
 * nothing more. It cannot see the source commits, the Node versions, the
 * dependency locks, or whether both arms ran the same benchmark source; those
 * are printed as a manual checklist on success rather than asserted.
 *
 * The complete form is a provenance manifest emitted by the A/B runner itself —
 * source commit, source-root hash, artifact hash, Node version and lock hash
 * per arm, plus benchmark source hash and the resolved workspace root against
 * `NX_WORKSPACE_ROOT_PATH` — with the runner refusing to emit a comparison
 * unless all of it holds. Until that exists, do not read a pass here as
 * "the experiment is sound"; read it as "the two arms are at least different
 * builds".
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};

/** Hash every file under a built barrel's directory, not just the barrel. */
function fingerprint(barrelPath) {
  const root = dirname(barrelPath);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(root);
  files.sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(relative(root, f));
    h.update(readFileSync(f));
  }
  return { digest: h.digest('hex'), fileCount: files.length, root };
}

function check({ oldBarrel, newBarrel, marker, expectMarker }) {
  const problems = [];
  for (const [label, p] of [
    ['--old', oldBarrel],
    ['--new', newBarrel],
  ]) {
    if (!p) problems.push(`${label} not given`);
    else if (!existsSync(p)) problems.push(`${label} does not exist: ${p}`);
  }
  if (problems.length) return { problems };

  if (statSync(oldBarrel).ino === statSync(newBarrel).ino) {
    problems.push(
      'the two barrels are the SAME FILE (same inode) — one path is a link to the other'
    );
  }

  const a = fingerprint(oldBarrel);
  const b = fingerprint(newBarrel);
  if (a.digest === b.digest) {
    problems.push(
      `the two build trees are BYTE-IDENTICAL (${a.fileCount} files, sha256 ` +
        `${a.digest.slice(
          0,
          16
        )}…). The historical build did not happen: nx almost ` +
        `certainly resolved NX_WORKSPACE_ROOT_PATH and rebuilt HEAD in place. ` +
        `Rebuild the historical side with \`env -u NX_WORKSPACE_ROOT_PATH\` from a ` +
        `directory containing no .git, with its own node_modules.`
    );
  }

  if (marker) {
    const inOld = existsSync(join(dirname(oldBarrel), marker));
    const inNew = existsSync(join(dirname(newBarrel), marker));
    if (inOld === inNew) {
      problems.push(
        `marker \`${marker}\` is ${
          inOld ? 'present in BOTH' : 'absent from BOTH'
        } ` +
          `builds. It was named to distinguish them, so it cannot do that. Pick a ` +
          `marker that exists on exactly one side of the comparison.`
      );
    } else if (expectMarker === 'new' && !inNew) {
      problems.push(
        `marker \`${marker}\` expected in --new but found in --old — arms are swapped`
      );
    } else if (expectMarker === 'old' && !inOld) {
      problems.push(
        `marker \`${marker}\` expected in --old but found in --new — arms are swapped`
      );
    }
  }
  return { problems, a, b };
}

if (process.argv.includes('--self-test')) {
  // Real fixtures on disk, because the two detections this checker makes are
  // different and a self-test that trips only the cheap one leaves the
  // expensive one uncovered. An earlier version passed both arms the same PATH,
  // which fires the same-inode check and never reaches the digest comparison —
  // so disabling the digest comparison entirely left the self-test green. The
  // gate harness caught that as BLIND, which is what it is for.
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import(
    'node:fs'
  );
  const { tmpdir } = await import('node:os');

  const base = mkdtempSync(join(tmpdir(), 'ab-isolation-selftest-'));
  const make = (name, body, extra) => {
    const dir = join(base, name, 'dist');
    mkdirSync(join(dir, 'lib', 'internals'), { recursive: true });
    writeFileSync(join(dir, 'index.js'), body);
    if (extra) writeFileSync(join(dir, 'lib', 'internals', 'marker.js'), extra);
    return join(dir, 'index.js');
  };

  let detectsIdenticalContent,
    acceptsDistinct,
    detectsUselessMarker,
    rejectsMissing;
  try {
    // Two DIFFERENT files with identical bytes — the real failure mode, and the
    // one that produced a fictitious 41x before it was noticed.
    const twinA = make('twin-a', 'export const x = 1;\n');
    const twinB = make('twin-b', 'export const x = 1;\n');
    detectsIdenticalContent = check({
      oldBarrel: twinA,
      newBarrel: twinB,
    }).problems.some((p) => /BYTE-IDENTICAL/.test(p));

    const realOld = make('real-old', 'export const x = 1;\n');
    const realNew = make(
      'real-new',
      'export const x = 2;\n',
      'export const marker = 1;\n'
    );
    acceptsDistinct =
      check({ oldBarrel: realOld, newBarrel: realNew }).problems.length === 0;

    // A marker present on neither side cannot distinguish the arms.
    detectsUselessMarker = check({
      oldBarrel: realOld,
      newBarrel: realNew,
      marker: 'lib/internals/absent.js',
    }).problems.some((p) => /cannot do that/.test(p));

    rejectsMissing =
      check({ oldBarrel: undefined, newBarrel: undefined }).problems.length ===
      2;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  if (
    !detectsIdenticalContent ||
    !acceptsDistinct ||
    !detectsUselessMarker ||
    !rejectsMissing
  ) {
    console.error(
      `\n❌ self-test FAILED — detects-identical-content=${detectsIdenticalContent} ` +
        `accepts-distinct=${acceptsDistinct} detects-useless-marker=${detectsUselessMarker} ` +
        `rejects-missing-args=${rejectsMissing}`
    );
    process.exit(1);
  }
  console.log(
    '✅ self-test: rejects two distinct paths holding identical builds, rejects a marker\n' +
      '   present on neither side, and accepts a genuinely distinct pair'
  );
  process.exit(0);
}

const result = check({
  oldBarrel: arg('--old', null),
  newBarrel: arg('--new', null),
  marker: arg('--marker', null),
  expectMarker: arg('--expect-marker', null),
});

if (result.problems.length) {
  console.error('\n❌ historical A/B is NOT isolated\n');
  for (const p of result.problems) console.error(`   • ${p}`);
  console.error(
    '\n   Any ratio derived from these two artifacts is meaningless. Do not record it.\n'
  );
  process.exit(1);
}

console.log('✅ the two builds are distinct artifacts');
console.log(
  `   old: ${result.a.fileCount} files, ${result.a.digest.slice(0, 16)}…`
);
console.log(
  `   new: ${result.b.fileCount} files, ${result.b.digest.slice(0, 16)}…`
);
console.log(
  '\n   Still verify by hand — these cannot be read off the artifacts:\n' +
    '     · the main dist mtime is UNCHANGED after building the historical side\n' +
    '     · the historical side was built with `env -u NX_WORKSPACE_ROOT_PATH`\n' +
    '     · the historical directory contains no .git and has its own node_modules\n' +
    '     · both arms run the SAME benchmark source, on the same Node\n'
);
