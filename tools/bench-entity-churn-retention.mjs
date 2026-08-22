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
 * by the causal-runtime adapter behind `timeTravel()`. If a tree with no
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
 *          [--rounds 50] [--json]
 *        node --expose-gc tools/bench-entity-churn-retention.mjs --arm <name> ...
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc, MB } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-entity-churn-retention.mjs');

const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
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
  'time-travel': {
    label: 'timeTravel() attached, no node reads',
    detail: 'a restorer EXISTS — does retention differ?',
    history: true,
    readNodes: false,
  },
  'time-travel-reads': {
    label: 'timeTravel() attached, byId() every row every round',
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
  const { signalTree, entityMap, timeTravel } = await import(CORE);

  const base = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
  const tree = a.history
    ? base.with(timeTravel({ maxHistorySize: 10_000 }))
    : base;
  const generation = (g) => {
    const d = [];
    for (let i = 0; i < WIDTH; i++)
      d.push({ id: `g${g}-${i}`, name: 'n' + i, v: i });
    return d;
  };

  tree.$.rows.setAll(generation(0));
  if (a.readNodes)
    for (let i = 0; i < WIDTH; i++) void tree.$.rows.byId(`g0-${i}`);

  // Baseline AFTER the first generation, so the figure is growth per RETIRED
  // subject and excludes the live collection entirely. Baselining before the
  // first setAll would fold the live rows in and overstate it.
  const before = (await quiesce({ label: `${name} (baseline)` })).heapUsed;

  for (let g = 1; g <= ROUNDS; g++) {
    tree.$.rows.setAll(generation(g));
    if (a.readNodes)
      for (let i = 0; i < WIDTH; i++) void tree.$.rows.byId(`g${g}-${i}`);
    // A turn per round: the notifier flushes on a microtask and history records
    // on a flush, so rounds without one coalesce and the arm measures fewer
    // logical generations than it claims to.
    await new Promise((r) => setTimeout(r, 0));
  }

  const after = (await quiesce({ label: `${name} (after churn)` })).heapUsed;

  // POSTCONDITION. Live membership must be exactly what it was: the entire
  // claim is "constant live cardinality, growing heap", and an arm whose
  // collection quietly grew would measure something else and look identical.
  const live = tree.$.rows.count();
  if (live !== WIDTH) {
    console.error(`❌ live membership drifted: ${live}, expected ${WIDTH}`);
    process.exit(1);
  }
  const retired = WIDTH * ROUNDS;
  console.log(
    JSON.stringify({
      arm: name,
      label: a.label,
      detail: a.detail,
      liveRows: WIDTH,
      rounds: ROUNDS,
      retiredSubjects: retired,
      growthMB: +((after - before) / MB).toFixed(2),
      bytesPerRetiredSubject: Math.round((after - before) / retired),
    })
  );
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
