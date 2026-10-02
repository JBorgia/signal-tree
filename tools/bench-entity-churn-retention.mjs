#!/usr/bin/env node
/**
 * RETENTION PER *RETIRED* SUBJECT — does a collection with constant membership
 * grow?
 *
 * ## Why this exists
 *
 * Every other memory measurement in this repo asks what N live entities cost.
 * This one holds N fixed and churns the KEYS, which is the shape a real list
 * has: a filter changes, a page turns, a poll replaces the rows. Live
 * cardinality never moves; the number of subjects that have ever existed climbs
 * without bound.
 *
 * It was written after the layer decomposition, because the layer numbers say
 * nothing about it — every arm there builds once and holds. A collection can be
 * 1,181 B/entity at rest and still be unbounded over time, and those are
 * different claims with different fixes.
 *
 * ## What is retained, and by what
 *
 * On removal (including the implicit removal inside `setAll`) a subject is
 * TOMBSTONED, not deleted:
 *
 *   - `StructuralStore.subjectStates` keeps a lifetime record. `retireSubject`
 *     does not delete it either — it overwrites it with
 *     `{active: false, restoreAllowed: false}`. Only `clear()` empties the map.
 *   - `EntityValueStore` is NOT told to retire the value, so the entity object
 *     itself stays reachable.
 *   - if `byId()` ever ran for that subject, `entitySignals` and
 *     `subjectStateSignals` keep a signal each. `subjectStateSignals` has no
 *     `delete` anywhere in the file.
 *
 * Tombstones default to `restoreAllowed: true`, so the retention presents
 * itself as EARNED — the subject can be restored. The arms below test whether
 * anything is in a position to do that: restoration is reachable only through
 * `__restoreOne` / `__planRestore`, which are non-enumerable and consumed only
 * by the causal-runtime adapter behind `restoration()`. If a tree with no
 * history enhancer retains exactly as much as one with it, the retention is not
 * conditioned on a restorer existing, and "earned by the restore contract" is
 * not available as an explanation for that part.
 *
 * ⚠️ This tool MEASURES and ATTRIBUTES. It does not assert a defect and there is
 * no budget here to fail against — see
 * `docs/architecture/entity-churn-retention.md` for the pre-registered
 * interpretation, written before any fix, so that the fix cannot quietly
 * redefine what counts as success.
 *
 * Usage: node --expose-gc tools/bench-entity-churn-retention.mjs [--width 1000]
 *          [--rounds 50] [--json] [--retain N] [--neutralize-retention]
 * Retention diagnostic: select the first N handles touched in generations
 * 1..rounds-1 (after baseline, all retired at the endpoint). Acquisition and
 * node reads are unchanged; neutralization omits only the strong references.
 * N must fit those generations. This is a diagnostic control, not a gate.
 *        node --expose-gc tools/bench-entity-churn-retention.mjs --arm <name> ...
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getHeapStatistics, getHeapSpaceStatistics } from 'node:v8';
import { quiesce, requireExposeGc, MB } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-entity-churn-retention.mjs');

const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};
const WIDTH = Number(arg('--width', 1000));
const ROUNDS = Number(arg('--rounds', 50));
const RETAIN = Number(arg('--retain', 0));
const NEUTRALIZE_RETENTION = process.argv.includes('--neutralize-retention');
for (const [name, value, minimum] of [
  ['width', WIDTH, 1],
  ['rounds', ROUNDS, 1],
  ['retain', RETAIN, 0],
]) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`--${name} must be an integer >= ${minimum}`);
  }
}
if (RETAIN > WIDTH * (ROUNDS - 1)) {
  throw new Error('--retain exceeds post-baseline retired-generation capacity');
}
const GC_PROTOCOL = {
  module: 'tools/lib/heap-quiescence.mjs',
  exposedGc: true,
  collectionsPerRound: 4,
  boundary: 'setTimeout(0)',
  epsilonBytes: 64 * 1024,
  stableRounds: 3,
  maxRounds: 40,
};
const MEASUREMENT_PROTOCOL = 'retired-node-diagnostics-v1';
// V8 snapshots and counters add diagnostic allocation/timing overhead; constancy
// not established. This is a new measurement protocol, not interchangeable data.
const runtime = () => ({
  node: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  pid: process.pid,
  heapLimitBytes: getHeapStatistics().heap_size_limit,
  execArgv: process.execArgv,
  nodeOptions: process.env.NODE_OPTIONS ?? null,
  gcProtocol: GC_PROTOCOL,
});
const memorySnapshot = (settled) => ({
  quiesceHeapUsed: settled.heapUsed,
  quiesceRounds: settled.rounds,
  memoryUsage: process.memoryUsage(),
  heapStatistics: getHeapStatistics(),
  heapSpaceStatistics: getHeapSpaceStatistics(),
});

const ARMS = {
  'no-history': {
    label: 'plain tree, no node reads',
    detail: 'nothing can restore; nothing is read',
    history: false,
    readNodes: false,
  },
  'no-history-reads': {
    label: 'plain tree, byId() every row every round',
    detail: 'nothing can restore; every row observed once',
    history: false,
    readNodes: true,
  },
  'no-history-node-reads': {
    label: 'plain tree, byId(id)() every row every round',
    detail:
      'nothing can restore; every row node READ (creates its activation carrier)',
    history: false,
    readNodes: true,
    readValues: true,
  },
  'time-travel': {
    label: 'restoration() attached, no node reads',
    detail: 'a restorer EXISTS — does retention differ?',
    history: true,
    readNodes: false,
  },
  'time-travel-reads': {
    label: 'restoration() attached, byId() every row every round',
    detail: 'restorer plus observation',
    history: true,
    readNodes: true,
  },
};

// --- child ------------------------------------------------------------------
const armFlag = process.argv.indexOf('--arm');
if (armFlag !== -1) {
  const name = process.argv[armFlag + 1];
  const a = ARMS[name];
  if (!a) {
    console.error(`unknown arm: ${name}`);
    process.exit(1);
  }
  if (RETAIN > 0 && !a.readNodes) {
    throw new Error(
      '--retain requires an arm that already acquires byId handles'
    );
  }
  const runtimeInfo = runtime();
  const { signalTree, entityMap, restoration } = await import(CORE);

  // v15: declared, so the no-history arm no longer carries the causal-runtime
  // plan that late `.with()` forced on every tree.
  const tree = signalTree(
    { rows: entityMap({ selectId: (r) => r.id }) },
    { enhancers: a.history ? [restoration({ maxHistorySize: 10_000 })] : [] }
  );
  const generation = (g) => {
    const d = [];
    for (let i = 0; i < WIDTH; i++)
      d.push({ id: `g${g}-${i}`, name: 'n' + i, v: i });
    return d;
  };

  const retainedNodes = [];
  let selectedHandles = 0;
  let byIdCalls = 0;
  let nodeReads = 0;
  let firstSelectedGeneration;
  let lastSelectedGeneration;
  tree.$.rows.setAll(generation(0));
  const touch = (id, g) => {
    const node = tree.$.rows.byId(id);
    byIdCalls++;
    if (!node) throw new Error(`Missing live handle: ${id}`);
    if (a.readValues) {
      void node();
      nodeReads++;
    }
    if (g > 0 && g < ROUNDS && selectedHandles < RETAIN) {
      selectedHandles++;
      firstSelectedGeneration ??= g;
      lastSelectedGeneration = g;
      if (!NEUTRALIZE_RETENTION) retainedNodes.push(node);
    }
  };
  if (a.readNodes) for (let i = 0; i < WIDTH; i++) touch(`g0-${i}`, 0);

  // Baseline AFTER the first generation, so the figure is growth per RETIRED
  // subject and excludes the live collection entirely. Baselining before the
  // first setAll would fold the live rows in and overstate it.
  const baseline = await quiesce({ label: `${name} (baseline)` });
  const before = baseline.heapUsed;
  const beforeMemory = memorySnapshot(baseline);

  for (let g = 1; g <= ROUNDS; g++) {
    tree.$.rows.setAll(generation(g));
    if (a.readNodes) for (let i = 0; i < WIDTH; i++) touch(`g${g}-${i}`, g);
    // A turn per round: the notifier flushes on a microtask and history records
    // on a flush, so rounds without one coalesce and the arm measures fewer
    // logical generations than it claims to.
    await new Promise((r) => setTimeout(r, 0));
  }

  const endpoint = await quiesce({ label: `${name} (after churn)` });
  const after = endpoint.heapUsed;
  const afterMemory = memorySnapshot(endpoint);
  // Read the strong roots AFTER the endpoint so they remain observable across GC.
  const expectedHeld = NEUTRALIZE_RETENTION ? 0 : RETAIN;
  const expectedTouches = a.readNodes ? WIDTH * (ROUNDS + 1) : 0;
  const uniqueHeld = new Set(retainedNodes).size;
  if (
    selectedHandles !== RETAIN ||
    retainedNodes.length !== expectedHeld ||
    uniqueHeld !== expectedHeld ||
    byIdCalls !== expectedTouches ||
    nodeReads !== (a.readValues ? expectedTouches : 0) ||
    (selectedHandles > 0 &&
      !(firstSelectedGeneration > 0 && lastSelectedGeneration < ROUNDS))
  ) {
    throw new Error('Retention/touch count postcondition failed');
  }

  // POSTCONDITION. Live membership must be exactly what it was: the entire
  // claim is "constant live cardinality, growing heap", and an arm whose
  // collection quietly grew would measure something else and look identical.
  const live = tree.$.rows.count();
  if (live !== WIDTH) {
    console.error(`❌ live membership drifted: ${live}, expected ${WIDTH}`);
    process.exit(1);
  }
  // All validation reads occur after BOTH memory snapshots, not in the workload.
  const finalIds = tree.$.rows.ids();
  const finalRows = tree.$.rows.all();
  const expectedRows = generation(ROUNDS);
  if (
    JSON.stringify(finalIds) !==
      JSON.stringify(expectedRows.map((row) => row.id)) ||
    JSON.stringify(finalRows) !== JSON.stringify(expectedRows)
  ) {
    throw new Error('Final generation IDs/content postcondition failed');
  }
  let postconditionNodeReads = 0;
  for (const node of retainedNodes) {
    postconditionNodeReads++;
    if (node() !== undefined)
      throw new Error('Intentionally held handle is not retired');
  }
  const retired = WIDTH * ROUNDS;
  console.log(
    JSON.stringify({
      arm: name,
      status: 'ok',
      measurementProtocol: MEASUREMENT_PROTOCOL,
      resolvedKernelEntry: CORE,
      protocolNote:
        'V8 snapshots/counters add diagnostic allocation/timing overhead; constancy not established; not the old heap-only instrument.',
      runtime: runtimeInfo,
      before: beforeMemory,
      after: afterMemory,
      retention: {
        requested: RETAIN,
        neutralized: NEUTRALIZE_RETENTION,
        selection:
          'first N touches in generations 1..rounds-1; all retired at endpoint',
        selectedHandles,
        heldHandles: retainedNodes.length,
        uniqueHeldHandles: uniqueHeld,
        firstSelectedGeneration: firstSelectedGeneration ?? null,
        lastSelectedGeneration: lastSelectedGeneration ?? null,
        liveGenerationHeld: 0,
        byIdCalls,
        nodeReads,
        countsValidated: true,
        postconditionNodeReads,
        heldHandlesReadUndefined: true,
        finalGenerationValidated: true,
      },
      label: a.label,
      detail: a.detail,
      liveRows: WIDTH,
      rounds: ROUNDS,
      retiredSubjects: retired,
      growthMB: +((after - before) / MB).toFixed(2),
      bytesPerRetiredSubject: Math.round((after - before) / retired),
    })
  );
  tree.destroy();
  process.exit(0);
}

// --- driver -------------------------------------------------------------------
const rows = [];
for (const name of Object.keys(ARMS)) {
  try {
    const out = execFileSync(
      process.execPath,
      [
        '--expose-gc',
        new URL(import.meta.url).pathname,
        '--arm',
        name,
        '--width',
        String(WIDTH),
        '--rounds',
        String(ROUNDS),
        '--retain',
        String(RETAIN),
        ...(NEUTRALIZE_RETENTION ? ['--neutralize-retention'] : []),
      ],
      {
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    rows.push(JSON.parse(out.trim().split('\n').pop()));
  } catch (err) {
    rows.push({
      arm: name,
      error: String(err.stderr || err.message)
        .split('\n')
        .filter(Boolean)
        .pop()
        ?.slice(0, 100),
    });
  }
}

const ok = rows.filter((r) => !r.error);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ width: WIDTH, rounds: ROUNDS, rows }, null, 2));
} else {
  console.log(
    `\nRETENTION PER RETIRED SUBJECT — ${WIDTH.toLocaleString()} live rows held constant, ` +
      `${ROUNDS} full key generations`
  );
  console.log(
    'quiesced per tools/lib/heap-quiescence.mjs; one process per arm\n'
  );
  console.log(
    '  ' +
      'arm'.padEnd(22) +
      'growth'.padStart(11) +
      'per retired'.padStart(14) +
      '   ' +
      'what it tests'
  );
  console.log('  ' + '─'.repeat(94));
  for (const r of ok) {
    console.log(
      '  ' +
        r.arm.padEnd(22) +
        `${r.growthMB.toFixed(2)} MB`.padStart(11) +
        `${r.bytesPerRetiredSubject} B`.padStart(14) +
        `   ${r.detail}`
    );
  }
  for (const r of rows.filter((r) => r.error)) {
    console.log('  ' + r.arm.padEnd(22) + '  — ' + r.error);
  }
  const get = (n) => ok.find((r) => r.arm === n)?.bytesPerRetiredSubject;
  const plain = get('no-history');
  const tt = get('time-travel');
  if (plain !== undefined && tt !== undefined) {
    const gap = Math.abs(tt - plain);
    console.log(
      `\n  With a restorer attached: ${tt} B/subject. Without one: ${plain} B/subject.` +
        `\n  Difference: ${gap} B/subject.` +
        (gap < plain * 0.1
          ? '\n  The retention is therefore NOT conditioned on a restorer existing — a tree' +
            '\n  that cannot restore anything retains the same per retired subject.'
          : '\n  A restorer changes the retention materially; part of it is plausibly earned.')
    );
  }
  console.log(`\n  ${ok.length}/${rows.length} arms completed`);
  console.log(
    '  Interpretation is pre-registered in docs/architecture/entity-churn-retention.md.'
  );
}
