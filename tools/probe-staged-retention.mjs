#!/usr/bin/env node
/**
 * STAGED RETENTION — is the bounded arm's slope RETENTION, or allocation churn
 * the collector has not returned?
 *
 * `probe-bounded-history-retention.mjs` runs one process per point and reports
 * `after - before` within it. At 320 rounds the bounded arm shows ~54 MB. But
 * an in-process census of every reachable Map/Set/Array — the entity
 * collection, the structural store, the time-travel manager, the path notifier
 * — finds NOTHING that grows once the reclamation sink is wired: retained
 * subjects sit at a constant 4,000, orphans at 0, history at 20.
 *
 * Both cannot be true of the same heap, so one of the two measurements is
 * measuring something other than what it says.
 *
 * This one shares a single heap across all the points. If retention is bounded,
 * the quiesced heap after 320 rounds is close to the heap after 20 — the tree
 * holds the same live set either way. If it keeps climbing in one process, the
 * retention is real and the census is blind to it.
 *
 * Usage:
 *   node --expose-gc tools/probe-staged-retention.mjs [--width 200] [--history 20]
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc, MB } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/probe-staged-retention.mjs');

const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: npx nx build core');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};

const WIDTH = Number(arg('--width', 200));
const HISTORY = Number(arg('--history', 20));
const POINTS = [20, 40, 80, 160, 320];

const { signalTree, entityMap, restoration } = await import(CORE);

const tree = signalTree(
  { rows: entityMap({ selectId: (r) => r.id }) },
  { enhancers: [restoration({ maxHistorySize: HISTORY })] }
);
const rows = tree.$.rows;

const generation = (g) => {
  const out = [];
  for (let i = 0; i < WIDTH; i++) {
    out.push({ id: `g${g}-${i}`, name: 'n' + i, v: i });
  }
  return out;
};

rows.setAll(generation(0));
await new Promise((r) => setTimeout(r, 0));
const baseline = (await quiesce({ label: 'baseline' })).heapUsed;

console.log(
  `STAGED RETENTION — ${WIDTH} live rows, maxHistorySize ${HISTORY}, ONE process\n\n` +
    '  rounds   retired    heap over baseline   B/retired   retained   history'
);

let g = 1;
for (const rounds of POINTS) {
  for (; g <= rounds; g++) {
    rows.setAll(generation(g));
    await new Promise((r) => setTimeout(r, 0));
  }
  const heap = (await quiesce({ label: `${rounds}` })).heapUsed;
  const retiredSubjects = WIDTH * rounds;
  console.log(
    `  ${String(rounds).padStart(6)}  ${String(retiredSubjects).padStart(8)}  ` +
      `${String(+((heap - baseline) / MB).toFixed(2)).padStart(18)} MB  ` +
      `${String(Math.round((heap - baseline) / retiredSubjects)).padStart(9)}   ` +
      `${String(rows.__listSubjectReclamationCandidates().length).padStart(8)}   ` +
      `${String(tree.getRestorationHistory().length).padStart(7)}`
  );
}

// Postconditions: a flat line produced by a dead tree is not a pass.
if (rows.count() !== WIDTH) {
  console.error(`❌ live membership drifted: ${rows.count()}`);
  process.exit(1);
}
const first = rows.ids()[0];
tree.undo();
await new Promise((r) => setTimeout(r, 0));
if (rows.ids()[0] === first) {
  console.error('❌ undo did nothing — history is not alive');
  process.exit(1);
}
console.log('\n  postconditions: live membership held, undo works');
