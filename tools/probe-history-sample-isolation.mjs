#!/usr/bin/env node
/**
 * DISCRIMINATOR — why does the featured wide-update cell OOM across samples?
 *
 * `tools/bench-update-matrix.mjs` needed its sample count reduced for
 * `signaltree / featured / update-100-fields @ 10k`: it OOMs at 8 GB with five
 * samples but not three, while five SETUP-ONLY builds of the same fixture settle
 * at ~277 MB. So the history-recording update loop creates the retained
 * material. That much is established.
 *
 * What is NOT established is who holds it, and the two candidates are different
 * findings entirely:
 *
 *     A. the library retains something globally or externally, so a completed
 *        store stays reachable after the reference to it is dropped
 *
 *     B. the harness retains the completed sample — through a result closure,
 *        a captured error, reporter state, anything that outlives the loop body
 *
 * A is Step 8 material. B is a benchmark bug that would have made an honest
 * measurement look like a library defect. Attributing A without ruling out B is
 * exactly the mistake this repo keeps writing gates against.
 *
 * ## The three arms
 *
 *   inprocess   N builds in ONE process, settled heap after each.
 *               Reproduces the failure regime.
 *
 *   isolated    N builds, ONE PROCESS EACH, settled heap from each.
 *               The discriminator. If per-build heap is flat and bounded here
 *               while `inprocess` climbs, something spanning samples is holding
 *               completed stores — cause A or B, and the next arm separates
 *               those. If `isolated` shows the same per-build figure as the
 *               first `inprocess` build, the single-store cost is simply large
 *               and the accumulation is the whole story.
 *
 *   growth      ONE build, one process, mutation count varied.
 *               If settled heap climbs with mutations, the history structure
 *               owns the problem directly and no cross-sample effect is needed
 *               to explain it.
 *
 * ## This does not change checkpoint 1
 *
 * The baseline in docs/architecture/v15-update-matrix-baseline.md is frozen.
 * This probe explains one footnote in it; it does not revise a number.
 *
 * Usage:
 *   node --expose-gc tools/probe-history-sample-isolation.mjs [--builds 6]
 *                    [--rows 10000] [--fields 100] [--updates 200] [--json]
 *   node --expose-gc tools/probe-history-sample-isolation.mjs --one-build ...
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc, MB } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/probe-history-sample-isolation.mjs');

const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};

const BUILDS = Number(arg('--builds', 6));
const ROWS = Number(arg('--rows', 10_000));
const FIELDS = Number(arg('--fields', 100));
const UPDATES = Number(arg('--updates', 200));
const CHILD_HEAP_MB = Number(arg('--child-heap-mb', 8192));

const widePatch = (count, salt) => {
  const patch = {};
  for (let f = 0; f < count; f++) patch['f' + f] = `${salt}-${f}`;
  return patch;
};

/**
 * One build: construct the featured store, seed it, run the update loop.
 *
 * Returns nothing on purpose. A build that handed something back would be
 * indistinguishable from cause B — the caller holding the store is the very
 * thing under investigation.
 */
async function oneBuild(rows, fields, updates, { destroy = false } = {}) {
  const { signalTree, entityMap, timeTravel, batching, transactions } =
    await import(CORE);
  const tree = signalTree(
    { rows: entityMap({ selectId: (r) => r.id }) },
    {
      enhancers: [
        timeTravel({ maxHistorySize: 200 }),
        batching(),
        transactions(),
      ],
    }
  );
  const seeded = [];
  for (let i = 0; i < rows; i++) {
    seeded.push({ id: i, ...widePatch(fields, 'init') });
  }
  tree.$.rows.setAll(seeded);
  for (let u = 0; u < updates; u++) {
    tree.$.rows.updateOne(u % rows, widePatch(fields, 'u' + u));
  }
  // Postcondition: a loop whose writes did not land would retain nothing and
  // report a flat, reassuring, meaningless curve.
  if (updates > 0) {
    const last = tree.$.rows.byId((updates - 1) % rows)?.();
    if (last?.['f' + (fields - 1)] !== `u${updates - 1}-${fields - 1}`) {
      throw new Error('probe postcondition failed: the updates did not land');
    }
  }
  if (destroy) {
    tree.destroy();
  }
}

// --- child: N builds in one process, cumulative heap after each -------------
//
// This arm runs in a child on purpose. The first version ran it in the parent,
// and when build 6 OOM'd it took the process down with it — so the two arms
// that would have EXPLAINED the failure never ran. A diagnostic that dies at
// the moment its subject appears is not a diagnostic.
if (process.argv.includes('--in-process-arm')) {
  const base = await quiesce({ label: 'inprocess baseline' });
  const results = [];
  for (let b = 1; b <= BUILDS; b++) {
    await oneBuild(ROWS, FIELDS, UPDATES, {
      destroy: process.argv.includes('--destroy'),
    });
    const settled = await quiesce({ label: `inprocess build ${b}` });
    results.push({
      build: b,
      cumulativeMB: +((settled.heapUsed - base.heapUsed) / MB).toFixed(2),
    });
    // Streamed, so a run that dies mid-arm still leaves the curve behind.
    console.log(JSON.stringify(results.at(-1)));
  }
  process.exit(0);
}

// --- child: exactly one build, then report ---------------------------------
if (process.argv.includes('--one-build')) {
  const base = await quiesce({ label: 'child baseline' });
  await oneBuild(ROWS, FIELDS, UPDATES);
  const settled = await quiesce({ label: 'child settled' });
  console.log(
    JSON.stringify({
      settledMB: +((settled.heapUsed - base.heapUsed) / MB).toFixed(2),
    })
  );
  process.exit(0);
}

const runIsolatedBuild = (updates) => {
  const out = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      `--max-old-space-size=${CHILD_HEAP_MB}`,
      join(process.cwd(), 'tools/probe-history-sample-isolation.mjs'),
      '--one-build',
      '--rows',
      String(ROWS),
      '--fields',
      String(FIELDS),
      '--updates',
      String(updates),
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 }
  );
  return JSON.parse(out.trim().split('\n').at(-1));
};

const report = { rows: ROWS, fields: FIELDS, updates: UPDATES, arms: {} };

console.log(
  `HISTORY SAMPLE ISOLATION — ${ROWS} rows x ${FIELDS} fields, ` +
    `${UPDATES} updates per build, featured config\n`
);

// --- arms 1 and 1b: in-process, N builds, without and with destroy() --------
function runInProcessArm(destroy) {
  const rows = [];
  let stdout = '';
  let died = false;
  try {
    stdout = execFileSync(
      process.execPath,
      [
        '--expose-gc',
        `--max-old-space-size=${CHILD_HEAP_MB}`,
        join(process.cwd(), 'tools/probe-history-sample-isolation.mjs'),
        '--in-process-arm',
        ...(destroy ? ['--destroy'] : []),
        '--builds',
        String(BUILDS),
        '--rows',
        String(ROWS),
        '--fields',
        String(FIELDS),
        '--updates',
        String(UPDATES),
      ],
      { encoding: 'utf8', maxBuffer: 1 << 26 }
    );
  } catch (error) {
    // Partial output is the interesting output here: the curve up to the point
    // it fell over is the measurement.
    stdout = String(error.stdout ?? '');
    died = true;
  }
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    try {
      const row = JSON.parse(line);
      rows.push(row);
      console.log(
        `  build ${row.build}: cumulative ${String(row.cumulativeMB).padStart(8)} MB`
      );
    } catch {
      /* not a result line */
    }
  }
  if (died) {
    const next = rows.length + 1;
    rows.push({ build: next, failed: true, oom: true });
    console.log(`  build ${next}: OOM`);
  }
  return rows;
}

console.log('IN-PROCESS — successive builds in one process, tree ABANDONED');
const inprocess = runInProcessArm(false);
report.arms.inprocess = inprocess;

// THE CONTROL THAT DECIDES WHAT THE FINDING IS.
//
// If `destroy()` flattens this curve, the finding is a lifecycle contract — an
// abandoned tree must be destroyed, and the docs and the benchmark harness both
// have to say so. If it does not, a written-to tree is unreclaimable whatever
// the caller does, and that is a leak.
console.log('\nIN-PROCESS + destroy() — the same, calling tree.destroy()');
const inprocessDestroyed = runInProcessArm(true);
report.arms.inprocessDestroyed = inprocessDestroyed;

// --- arm 2: one process per build -------------------------------------------
console.log('\nISOLATED — one process per build, each reports its own store');
const isolated = [];
for (let b = 1; b <= BUILDS; b++) {
  try {
    const { settledMB } = runIsolatedBuild(UPDATES);
    isolated.push({ build: b, settledMB });
    console.log(`  build ${b}: ${String(settledMB).padStart(8)} MB`);
  } catch (error) {
    const oom = /JavaScript heap out of memory/.test(
      String(error.stderr ?? error.message)
    );
    isolated.push({ build: b, failed: true, oom });
    console.log(`  build ${b}: FAILED${oom ? ' (OOM)' : ''}`);
    break;
  }
}
report.arms.isolated = isolated;

// --- arm 3: one build, mutation count varied --------------------------------
console.log('\nGROWTH — one build per point, mutation count varied');
const growth = [];
for (const updates of [0, 50, 100, 200, 400]) {
  try {
    const { settledMB } = runIsolatedBuild(updates);
    growth.push({ updates, settledMB });
    console.log(
      `  ${String(updates).padStart(4)} updates: ${String(settledMB).padStart(8)} MB`
    );
  } catch (error) {
    const oom = /JavaScript heap out of memory/.test(
      String(error.stderr ?? error.message)
    );
    growth.push({ updates, failed: true, oom });
    console.log(`  ${String(updates).padStart(4)} updates: FAILED${oom ? ' (OOM)' : ''}`);
  }
}
report.arms.growth = growth;

// --- verdict ----------------------------------------------------------------
const firstInProcess = inprocess[0]?.cumulativeMB;
const lastInProcess = inprocess.filter((r) => !r.failed).at(-1)?.cumulativeMB;
const isolatedValues = isolated.filter((r) => !r.failed).map((r) => r.settledMB);
const isolatedMax = isolatedValues.length ? Math.max(...isolatedValues) : undefined;
const isolatedMin = isolatedValues.length ? Math.min(...isolatedValues) : undefined;
const growthValues = growth.filter((r) => !r.failed);
const growthFirst = growthValues[0]?.settledMB;
const growthLast = growthValues.at(-1)?.settledMB;

const destroyedLast = inprocessDestroyed
  .filter((r) => !r.failed)
  .at(-1)?.cumulativeMB;
const destroyedFirst = inprocessDestroyed[0]?.cumulativeMB;

console.log('\nVERDICT');
if (destroyedFirst !== undefined && destroyedLast !== undefined) {
  const destroyFlattens = destroyedLast < destroyedFirst * 1.5;
  console.log(
    destroyFlattens
      ? '  destroy() RELEASES the store. The accumulation is a LIFECYCLE CONTRACT\n' +
          '  issue, not a leak: an abandoned tree has to be destroyed, and both the\n' +
          '  docs and any harness that builds trees in a loop must say so.'
      : '  destroy() DOES NOT RELEASE the store. A tree that has taken writes stays\n' +
          '  reachable whatever the caller does — a leak, and the first thing Step 8\n' +
          '  has to explain.'
  );
}
if (isolatedMax !== undefined && firstInProcess !== undefined) {
  const isolatedFlat = isolatedMax - isolatedMin < Math.max(5, isolatedMax * 0.2);
  const inProcessClimbs =
    lastInProcess !== undefined && lastInProcess > firstInProcess * 1.5;

  if (isolatedFlat && inProcessClimbs) {
    console.log(
      '  CROSS-SAMPLE RETENTION. Each isolated build settles at about the same\n' +
        '  figure, while successive in-process builds accumulate. A completed\n' +
        '  store is still reachable after the loop drops it — cause A or B. The\n' +
        '  probe does not separate those; the next step is to null out the\n' +
        '  harness side (build inside a function that returns nothing, which is\n' +
        '  what `oneBuild` already does) and, if it persists, look for a global\n' +
        '  registry in the library.'
    );
  } else if (!inProcessClimbs) {
    console.log(
      '  NO CROSS-SAMPLE ACCUMULATION under this fixture. The in-process arm did\n' +
        '  not climb, so the matrix OOM is explained by the single-store cost\n' +
        '  times the sample count and nothing is leaking between samples.'
    );
  } else {
    console.log(
      '  MIXED. The isolated arm is not flat, so per-build cost varies on its own\n' +
        '  and the in-process climb cannot be attributed to cross-sample retention\n' +
        '  without controlling that first.'
    );
  }
} else {
  console.log('  INCONCLUSIVE — an arm failed before producing a comparison.');
}

if (growthFirst !== undefined && growthLast !== undefined) {
  const slope = growthLast - growthFirst;
  console.log(
    `\n  Per-build growth with mutation count: ${growthFirst} MB at 0 updates -> ` +
      `${growthLast} MB at ${growthValues.at(-1).updates}.\n` +
      `  ${
        slope > Math.max(5, growthFirst * 0.2)
          ? 'The history structure grows with mutations on its own — Step 8 owns this\n  directly, independent of anything cross-sample.'
          : 'Flat: a single build does not grow with mutation count, so the failure\n  regime needs the cross-sample effect to explain it.'
      }`
  );
}

console.log(
  '\n  Checkpoint 1 in docs/architecture/v15-update-matrix-baseline.md is FROZEN.\n' +
    '  This probe explains a footnote in it; it does not revise a number.'
);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
}
