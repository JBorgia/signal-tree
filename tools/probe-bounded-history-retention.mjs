#!/usr/bin/env node
/**
 * THE RC QUESTION: can a BOUNDED `restoration()` tree retain retired subjects
 * without bound?
 *
 * This decides whether Step 8 (history-owned reclamation) blocks
 * `15.0.0-rc.1` or belongs in the RC cycle / 15.x. The distinction is
 * correctness versus optimization:
 *
 *   RETAINS MORE THAN NECESSARY, BOUNDED
 *       every retired subject reachable from the retained history window is
 *       kept, the window is bounded, so total retention plateaus.
 *       -> OPTIMIZATION. Step 8 does not block the RC.
 *
 *   RETAINS WITHOUT BOUND
 *       subjects stay after the history entry that justified them was evicted,
 *       so retention grows with every retirement the tree has ever seen and a
 *       long-running app with `restoration()` grows forever.
 *       -> CORRECTNESS. Step 8 blocks the RC.
 *
 * `maxHistorySize` is enforced — `time-travel.ts` shifts the oldest entry off
 * when the buffer overflows. What is NOT established is whether that eviction
 * releases the entity-side backing of the subjects that entry referenced.
 * Nothing tells the entity layer a history reference disappeared, and zero-owner
 * reclamation deliberately does not run when a restorer exists.
 *
 * ## Method
 *
 * Live membership is held constant and the KEYS are churned, so every round
 * retires exactly `--width` subjects. History is bounded far below the number
 * of rounds, so it saturates early and every later round evicts.
 *
 *   bounded   maxHistorySize = 20, rounds well past it
 *   control   maxHistorySize large enough never to evict
 *
 * If retention is bounded, the `bounded` arm plateaus while `control` climbs.
 * If both climb at the same rate, eviction releases nothing.
 *
 * One process per point, quiesced through tools/lib/heap-quiescence.mjs.
 * Undo is exercised at the end of every point: a measurement taken against a
 * tree whose history silently stopped recording would plateau for the wrong
 * reason and read as a pass.
 *
 * Usage:
 *   node --expose-gc tools/probe-bounded-history-retention.mjs
 *        [--width 200] [--history 20] [--json]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc, MB } from './lib/heap-quiescence.mjs';

const SELF_TEST = process.argv.includes('--self-test');

// The self-test only exercises the pure verdict against recorded tables, so it
// needs no GC control — and requiring it would make the cheap check as awkward
// to run as the ten-minute one.
if (!SELF_TEST) {
  requireExposeGc('tools/probe-bounded-history-retention.mjs');
}

// The build check has to come AFTER the self-test branch below, not here.
// It used to sit at the top, so `--self-test` — which touches no build output
// at all, only recorded tables — printed "build first" and exited on any
// unbuilt checkout. Invisible in a warm tree; the 15.0 pristine-checkout
// rehearsal is what surfaced it.
const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
if (!SELF_TEST && !existsSync(CORE)) {
  console.error('❌ build first: npx nx build core');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};

const WIDTH = Number(arg('--width', 200));
const BOUNDED_HISTORY = Number(arg('--history', 20));
const UNBOUNDED_HISTORY = 100_000;
// Out to 320 because the shape only becomes unambiguous past ~160: B/retired
// falls while the fixed component amortizes, and a bounded regime and a linear
// one are hard to tell apart while it is still falling. By 320 it has settled.
const ROUND_POINTS = [20, 40, 80, 160, 320];

// --- child: one (arm, rounds) point ----------------------------------------
const pointFlag = process.argv.indexOf('--point');
if (pointFlag !== -1) {
  const [armName, roundsRaw] = process.argv.slice(pointFlag + 1, pointFlag + 3);
  const rounds = Number(roundsRaw);
  const maxHistorySize =
    armName === 'bounded' ? BOUNDED_HISTORY : UNBOUNDED_HISTORY;

  const { signalTree, entityMap, restoration } = await import(CORE);
  const tree = signalTree(
    { rows: entityMap({ selectId: (r) => r.id }) },
    { enhancers: [restoration({ maxHistorySize })] }
  );

  const generation = (g) => {
    const rows = [];
    for (let i = 0; i < WIDTH; i++) {
      rows.push({ id: `g${g}-${i}`, name: 'n' + i, v: i });
    }
    return rows;
  };

  tree.$.rows.setAll(generation(0));
  await new Promise((r) => setTimeout(r, 0));

  // Baseline AFTER the first generation, so the figure is growth per RETIRED
  // subject and excludes the live collection entirely.
  const before = (await quiesce({ label: `${armName}/${rounds} baseline` }))
    .heapUsed;

  for (let g = 1; g <= rounds; g++) {
    tree.$.rows.setAll(generation(g));
    // A turn per round: the notifier flushes on a microtask and history records
    // on a flush, so rounds without one coalesce and the arm measures fewer
    // logical generations than it claims to.
    await new Promise((r) => setTimeout(r, 0));
  }

  const after = (await quiesce({ label: `${armName}/${rounds} after` }))
    .heapUsed;

  // POSTCONDITIONS. Both exist because a plateau can be produced by BREAKAGE
  // just as easily as by reclamation, and the two look identical in a heap
  // figure.
  const live = tree.$.rows.count();
  if (live !== WIDTH) {
    console.error(`❌ live membership drifted: ${live}, expected ${WIDTH}`);
    process.exit(1);
  }

  const historyLength = tree.getRestorationHistory().length;
  const expectedCap = armName === 'bounded' ? BOUNDED_HISTORY : rounds + 1;
  if (armName === 'bounded' && historyLength > BOUNDED_HISTORY) {
    console.error(
      `❌ history overflowed its bound: ${historyLength} > ${BOUNDED_HISTORY}`
    );
    process.exit(1);
  }

  // And history must still WORK: undo has to move the collection back to the
  // previous generation. A tree that quietly stopped recording would plateau
  // and read as a pass.
  const beforeUndo = tree.$.rows.ids()[0];
  tree.undo();
  await new Promise((r) => setTimeout(r, 0));
  const afterUndo = tree.$.rows.ids()[0];
  const undoWorks = beforeUndo !== afterUndo;

  console.log(
    JSON.stringify({
      arm: armName,
      rounds,
      retiredSubjects: WIDTH * rounds,
      historyLength,
      expectedCap,
      undoWorks,
      growthMB: +((after - before) / MB).toFixed(2),
      bytesPerRetired: Math.round((after - before) / (WIDTH * rounds)),
    })
  );
  process.exit(0);
}

// --- driver ------------------------------------------------------------------
const runPoint = (arm, rounds) => {
  const out = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      '--max-old-space-size=8192',
      join(process.cwd(), 'tools/probe-bounded-history-retention.mjs'),
      '--point',
      arm,
      String(rounds),
      '--width',
      String(WIDTH),
      '--history',
      String(BOUNDED_HISTORY),
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 }
  );
  return JSON.parse(out.trim().split('\n').at(-1));
};

/**
 * Pure verdict, so the self-test can exercise it without a 10-minute run.
 *
 * `< 2` and not `< roundRatio / 2`. The original threshold passed anything
 * growing slower than half the churn, which at 16x the rounds blessed 8x — and
 * a real run measuring 8.1x briefly reported BOUNDED over 6.8 MB -> 54 MB.
 * "Grows more slowly than the churn" is satisfied by any O(n) term with a small
 * constant; "bounded" means the retained set is the window, so the total is
 * close at the smallest and largest round counts.
 */
export function isBounded(points) {
  const first = points[0];
  const last = points.at(-1);
  const ratio = first.growthMB > 0.1 ? last.growthMB / first.growthMB : Infinity;
  return ratio < 2;
}

if (SELF_TEST) {
  // The real pre-fix table, and the real post-fix one. Both measured, both in
  // docs/architecture/retired-subject-churn.md.
  const UNBOUNDED = [
    { rounds: 20, growthMB: 6.66 },
    { rounds: 40, growthMB: 10.78 },
    { rounds: 80, growthMB: 16.96 },
    { rounds: 160, growthMB: 31.79 },
    { rounds: 320, growthMB: 61.29 },
  ];
  const FLAT = [
    { rounds: 20, growthMB: 6.66 },
    { rounds: 40, growthMB: 7.99 },
    { rounds: 80, growthMB: 8.45 },
    { rounds: 160, growthMB: 8.7 },
    { rounds: 320, growthMB: 8.63 },
  ];
  // The one that mattered: the table the OLD threshold accepted. 54/6.66 = 8.1x,
  // under `roundRatio / 2` = 8, so it passed. It must not now.
  const FALSE_GREEN = [
    { rounds: 20, growthMB: 6.66 },
    { rounds: 40, growthMB: 10.59 },
    { rounds: 80, growthMB: 16.22 },
    { rounds: 160, growthMB: 29.54 },
    { rounds: 320, growthMB: 54.05 },
  ];

  const problems = [];
  if (isBounded(UNBOUNDED)) {
    problems.push('accepted the pre-fix unbounded table (6.66 -> 61.29 MB)');
  }
  if (isBounded(FALSE_GREEN)) {
    problems.push(
      'accepted the 8.1x table the old `< roundRatio / 2` threshold blessed ' +
        '(6.66 -> 54.05 MB)'
    );
  }
  if (!isBounded(FLAT)) {
    problems.push('rejected the measured flat table (6.66 -> 8.63 MB)');
  }

  if (problems.length > 0) {
    console.error('❌ bounded-history verdict self-test FAILED');
    for (const problem of problems) console.error(`   - ${problem}`);
    process.exit(1);
  }
  console.log(
    '✅ the bounded-history verdict rejects both the pre-fix table and the 8.1x\n' +
      '   table its first threshold accepted, and accepts the measured flat one'
  );
  process.exit(0);
}

console.log(
  `BOUNDED-HISTORY RETENTION — ${WIDTH} live rows held constant, keys churned\n` +
    `  bounded arm: maxHistorySize ${BOUNDED_HISTORY}   ` +
    `control arm: maxHistorySize ${UNBOUNDED_HISTORY} (never evicts)\n`
);

const report = { width: WIDTH, boundedHistory: BOUNDED_HISTORY, arms: {} };

for (const arm of ['bounded', 'control']) {
  console.log(
    `${arm.toUpperCase()}\n` +
      '  rounds   retired    growth    B/retired   history   undo'
  );
  const points = [];
  for (const rounds of ROUND_POINTS) {
    const p = runPoint(arm, rounds);
    points.push(p);
    console.log(
      `  ${String(p.rounds).padStart(6)}  ${String(p.retiredSubjects).padStart(
        8
      )}  ${String(p.growthMB).padStart(8)} MB  ${String(
        p.bytesPerRetired
      ).padStart(8)}   ${String(p.historyLength).padStart(7)}   ${
        p.undoWorks ? 'ok' : 'DEAD'
      }`
    );
  }
  report.arms[arm] = points;
  console.log('');
}

// --- verdict -------------------------------------------------------------------
const bounded = report.arms.bounded;
const control = report.arms.control;
const growth = (points) => {
  const first = points[0];
  const last = points.at(-1);
  return {
    first: first.growthMB,
    last: last.growthMB,
    ratio: first.growthMB > 0.1 ? last.growthMB / first.growthMB : Infinity,
    roundRatio: last.rounds / first.rounds,
  };
};
const b = growth(bounded);
const c = growth(control);

console.log('VERDICT');
console.log(
  `  rounds grew ${b.roundRatio}x.  bounded arm grew ${b.ratio.toFixed(1)}x, ` +
    `control arm grew ${c.ratio.toFixed(1)}x.\n`
);

const anyUndoDead = [...bounded, ...control].some((p) => !p.undoWorks);
if (anyUndoDead) {
  console.error(
    '  INVALID — undo stopped working at some point, so a plateau cannot be\n' +
      '  distinguished from history silently ceasing to record.'
  );
  process.exit(1);
}

const boundedIsFlat = isBounded(bounded);

if (boundedIsFlat) {
  console.log(
    '  BOUNDED. Retention plateaus once the history window saturates, so a\n' +
      '  tree with a bounded `restoration()` does NOT grow with the number of\n' +
      '  subjects it has ever retired. Step 8 is an OPTIMIZATION — it removes\n' +
      '  retention that is real but bounded — and does not block the RC.'
  );
} else {
  console.log(
    '  UNBOUNDED. The bounded arm grows with the round count, so evicting a\n' +
      '  history entry does not release the entity-side backing of the subjects\n' +
      '  it referenced. A long-running tree with `restoration()` grows forever,\n' +
      '  which is a CORRECTNESS defect and blocks the RC. Step 8 first.'
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
}

process.exit(boundedIsFlat ? 0 : 1);
