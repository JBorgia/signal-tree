#!/usr/bin/env node
/**
 * A RETAINED-HEAP TABLE MUST BE INTERNALLY POSSIBLE.
 *
 * ## Why this exists
 *
 * `tools/memory-report.mjs` published this pair, from the same run, as an
 * ablation:
 *
 *   entityMap, 10k entities ....................... 59.95 MB
 *   entityMap 10k + byId() on every row, NOT held .. 18.03 MB
 *
 * The second scenario does everything the first does and then materialises a
 * node for all 10,000 rows, which permanently populates the strong
 * `entitySignals` map. It retains strictly more. A table saying it retains
 * 42 MB less is not a surprising result about weak caches — it is a table that
 * cannot be true, and it was read for weeks as evidence about where entityMap's
 * memory goes. It came from a `yieldBeforeMeasure` flag set on that one
 * scenario, so the two rows were read at different points on the reclamation
 * curve.
 *
 * The repo already had the general lesson written down twice — memory-report's
 * own header says "strictly more data cannot retain less" about an EARLIER
 * instance of the same defect, caught in review rather than by a check. Writing
 * the lesson in a comment did not stop the second instance. This does:
 *
 *   for every pair where one scenario's held state is a strict superset of
 *   another's, the superset must not measure smaller.
 *
 * That invariant is violated by ANY unequal settling protocol, which is what
 * makes it the right check rather than "assert nobody wrote yieldBeforeMeasure
 * again". A future flag with a different name fails this the same way.
 *
 * ## What it does NOT check
 *
 * Not the absolute numbers — those are the measurement, and pinning them would
 * turn every legitimate improvement into a gate failure. Only the ordering that
 * the containment relation forces.
 *
 * Usage: node --expose-gc tools/check-memory-harness.mjs
 *        node --expose-gc tools/check-memory-harness.mjs --self-test
 */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Pairs where `superset` holds everything `subset` holds, plus more.
 *
 * Kept to relations that are true by CONSTRUCTION — read the two builders in
 * memory-report.mjs and one is the other plus extra retained objects. Pairs
 * that merely "ought to" rank a certain way are not invariants, they are
 * predictions, and a gate that encodes a prediction fails on discovery.
 */
const CONTAINMENTS = [
  {
    subset: 'entityMap, 10k entities',
    superset: 'entityMap 10k + a held tree() snapshot',
    because: 'the snapshot arm holds the same tree plus a tree() result',
  },
  {
    subset: 'entityMap, 10k entities',
    superset: 'entityMap 10k + byId() on every row, NOT held',
    because:
      'materialising a node populates the strong entitySignals map, which is ' +
      'never pruned for a live entity — the nodes go, that does not',
  },
  {
    subset: 'entityMap 10k + byId() on every row, NOT held',
    superset: 'entityMap 10k + byId() on EVERY row',
    because: 'same walk, but every node is retained instead of dropped',
  },
  {
    subset: 'entityMap, 1k entities',
    superset: 'entityMap, 10k entities',
    because: 'ten times the entities in the same shape',
  },
];

/**
 * Measurement noise, not a budget. Set from observed run-to-run spread: the
 * scenarios above reproduce to 0.01 MB across repeated runs, so 0.25 MB is
 * ~25x the noise and still far below any violation this can catch (the one it
 * was written for was 42 MB).
 */
const TOLERANCE_MB = 0.25;

function check(rows) {
  const by = new Map(rows.map((r) => [r.scenario, r]));
  const failures = [];
  const missing = [];
  for (const c of CONTAINMENTS) {
    const sub = by.get(c.subset);
    const sup = by.get(c.superset);
    if (!sub || !sup) {
      missing.push(!sub ? c.subset : c.superset);
      continue;
    }
    if (sup.retainedMB < sub.retainedMB - TOLERANCE_MB) {
      failures.push({ ...c, subMB: sub.retainedMB, supMB: sup.retainedMB });
    }
  }
  return { failures, missing };
}

// --- self-test: prove the checker can fail ---------------------------------
if (process.argv.includes('--self-test')) {
  const impossible = [
    { scenario: 'entityMap, 1k entities', retainedMB: 1.34 },
    { scenario: 'entityMap, 10k entities', retainedMB: 59.95 },
    { scenario: 'entityMap 10k + a held tree() snapshot', retainedMB: 59.96 },
    { scenario: 'entityMap 10k + byId() on EVERY row', retainedMB: 65.29 },
    // The real published number, from the real defect.
    {
      scenario: 'entityMap 10k + byId() on every row, NOT held',
      retainedMB: 18.03,
    },
  ];
  const bad = check(impossible);
  const possible = impossible.map((r) =>
    r.scenario.endsWith('NOT held') ? { ...r, retainedMB: 61.0 } : r
  );
  const good = check(possible);

  // ONE violated pair, not two: the shipped table put the transient arm below
  // the plain 10k arm (impossible) but still below the held arm (fine), so only
  // the `10k -> transient` containment is broken by it. Asserting two was this
  // check's own first bug, and its self-test caught it — which is the argument
  // for self-tests over confidence.
  const detects = bad.failures.length === 1 && bad.missing.length === 0;
  const accepts = good.failures.length === 0 && good.missing.length === 0;
  if (!detects || !accepts) {
    console.error(
      `\n❌ self-test FAILED — detects-the-real-defect=${detects} ` +
        `accepts-a-consistent-table=${accepts}\n` +
        `   (rejected ${bad.failures.length} of an expected 1; ` +
        `flagged ${good.failures.length} of an expected 0)`
    );
    process.exit(1);
  }
  console.log(
    '✅ self-test: rejects the 59.95/18.03 table that shipped, accepts a consistent one'
  );
  process.exit(0);
}

// --- live: measure, then check ----------------------------------------------
let report;
try {
  const out = execFileSync(
    process.execPath,
    ['--expose-gc', join(ROOT, 'tools/memory-report.mjs'), '--json'],
    { encoding: 'utf8', cwd: ROOT, maxBuffer: 8 * 1024 * 1024 }
  );
  report = JSON.parse(out);
} catch (err) {
  console.error('❌ could not run tools/memory-report.mjs --json');
  console.error(String(err.stderr || err.message).slice(0, 600));
  process.exit(1);
}

const { failures, missing } = check(report.rows);

if (missing.length) {
  console.error(
    `\n❌ memory-report no longer emits: ${[...new Set(missing)].join(
      ', '
    )}\n` +
      '   A containment pair that silently stops being checked is how the first\n' +
      '   instance of this defect survived. Update CONTAINMENTS deliberately.'
  );
  process.exit(1);
}

if (failures.length) {
  console.error('\n❌ retained-heap table is internally impossible\n');
  for (const f of failures) {
    console.error(`   ${f.superset}`);
    console.error(`     measured ${f.supMB.toFixed(2)} MB`);
    console.error(`   ${f.subset}`);
    console.error(`     measured ${f.subMB.toFixed(2)} MB`);
    console.error(`   but the first contains the second — ${f.because}.`);
    console.error(
      `   A superset cannot retain ${(f.subMB - f.supMB).toFixed(
        2
      )} MB less. The\n` +
        '   likeliest cause is an unequal settling protocol between the two arms:\n' +
        '   every scenario must go through tools/lib/heap-quiescence.mjs.\n'
    );
  }
  process.exit(1);
}

console.log(
  `✅ retained-heap table is internally consistent ` +
    `(${CONTAINMENTS.length} containment pairs, ${report.rows.length} scenarios)`
);
for (const c of CONTAINMENTS) {
  const by = new Map(report.rows.map((r) => [r.scenario, r]));
  console.log(
    `   ${by.get(c.subset).retainedMB.toFixed(2)} MB ≤ ` +
      `${by.get(c.superset).retainedMB.toFixed(2)} MB   ${c.superset}`
  );
}
