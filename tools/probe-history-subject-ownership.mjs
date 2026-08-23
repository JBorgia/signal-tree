#!/usr/bin/env node
/**
 * STEP 8, NULL FIRST — are the physically retained subjects SEMANTICALLY OWNED?
 *
 * `probe-bounded-history-retention.mjs` established that a tree with
 * `maxHistorySize: 20` still grows with total churn: 5.67 MB at 4,000 retired
 * subjects, 60.02 MB at 64,000, with history pinned at 20 entries and `undo()`
 * working throughout. It did NOT establish why.
 *
 * The hypothesis is that eviction ends a restoration claim without releasing
 * the physical backing, so retired subjects accumulate that no retained history
 * entry can restore. This probe tests that before any mechanism is designed:
 *
 *     orphanRetiredSubjects = physicallyRetained - semanticallyOwned
 *
 * If the orphan count climbs with the retention slope, the explanation holds
 * and the fix belongs at the eviction boundary. If it does NOT climb, the
 * explanation is incomplete and the ~983 B/retired term is something else —
 * STOP and find out what, rather than building a claim registry against a
 * hypothesis that has not survived.
 *
 * ## How each side is counted
 *
 * PHYSICALLY RETAINED — `__listSubjectReclamationCandidates()`, which is the
 * entity layer's own answer: tombstoned subjects that still hold value backing.
 * Not a heap estimate, an inventory.
 *
 * SEMANTICALLY OWNED — the union of `restorationSubjectIds` across every RETAINED
 * history entry, undo side and redo side alike, intersected with the retired
 * set. Live subjects appear in that union too and are not retired, so they must
 * be excluded or the orphan count is understated.
 *
 * ⚠️ `restorationSubjectIds` is the set of subjects a write TOUCHED, which is a claim
 * that a restore of that entry needs them. It is not the same as "every subject
 * mentioned in `entry.state`", and it must not be replaced by a snapshot walk:
 * a snapshot names the whole collection, so counting it would make every
 * retained entry claim every subject and reproduce the current over-retention
 * inside a tidier data structure.
 *
 * Usage:
 *   node --expose-gc tools/probe-history-subject-ownership.mjs
 *        [--width 200] [--history 20] [--json]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc, MB } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/probe-history-subject-ownership.mjs');

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
const ROUND_POINTS = [20, 40, 80, 160, 320];

// --- child: one round count -------------------------------------------------
const pointFlag = process.argv.indexOf('--point');
if (pointFlag !== -1) {
  const rounds = Number(process.argv[pointFlag + 1]);
  const { signalTree, entityMap, timeTravel } = await import(CORE);
  const tree = signalTree(
    { rows: entityMap({ selectId: (r) => r.id }) },
    { enhancers: [timeTravel({ maxHistorySize: HISTORY })] }
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
  const before = (await quiesce({ label: `${rounds} baseline` })).heapUsed;

  for (let g = 1; g <= rounds; g++) {
    rows.setAll(generation(g));
    await new Promise((r) => setTimeout(r, 0));
  }
  const after = (await quiesce({ label: `${rounds} after` })).heapUsed;

  // --- the two inventories ---------------------------------------------------
  const physicallyRetained = rows.__listSubjectReclamationCandidates();
  const physicalSet = new Set(physicallyRetained);

  const history = tree.getHistory();
  const claimedByHistory = new Set();
  for (const entry of history) {
    for (const subjectId of entry.restorationSubjectIds ?? []) {
      claimedByHistory.add(subjectId);
    }
  }

  // Only claims on subjects that are actually retired count as ownership of
  // retained backing; a claim on a live subject explains nothing.
  const ownedRetired = [...claimedByHistory].filter((id) =>
    physicalSet.has(id)
  );
  const orphans = physicallyRetained.filter((id) => !claimedByHistory.has(id));

  // POSTCONDITIONS — a plateau or a low orphan count produced by breakage looks
  // the same as one produced by correctness.
  if (rows.count() !== WIDTH) {
    console.error(`❌ live membership drifted: ${rows.count()}`);
    process.exit(1);
  }
  if (history.length > HISTORY) {
    console.error(`❌ history overflowed: ${history.length} > ${HISTORY}`);
    process.exit(1);
  }
  const firstBefore = rows.ids()[0];
  tree.undo();
  await new Promise((r) => setTimeout(r, 0));
  if (rows.ids()[0] === firstBefore) {
    console.error('❌ undo did nothing — history is not alive');
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      rounds,
      totalRetired: WIDTH * rounds,
      historyLength: history.length,
      physicallyRetained: physicallyRetained.length,
      claimedByHistory: claimedByHistory.size,
      ownedRetired: ownedRetired.length,
      orphans: orphans.length,
      growthMB: +((after - before) / MB).toFixed(2),
    })
  );
  process.exit(0);
}

// --- driver -------------------------------------------------------------------
const runPoint = (rounds) => {
  const out = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      '--max-old-space-size=8192',
      join(process.cwd(), 'tools/probe-history-subject-ownership.mjs'),
      '--point',
      String(rounds),
      '--width',
      String(WIDTH),
      '--history',
      String(HISTORY),
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 }
  );
  return JSON.parse(out.trim().split('\n').at(-1));
};

console.log(
  `RETIRED-SUBJECT OWNERSHIP — ${WIDTH} live rows, maxHistorySize ${HISTORY}\n\n` +
    '  rounds   retired   physical   claimed   owned   ORPHANS   growth'
);

const points = [];
for (const rounds of ROUND_POINTS) {
  const p = runPoint(rounds);
  points.push(p);
  console.log(
    `  ${String(p.rounds).padStart(6)}  ${String(p.totalRetired).padStart(8)}  ` +
      `${String(p.physicallyRetained).padStart(8)}  ${String(
        p.claimedByHistory
      ).padStart(8)}  ${String(p.ownedRetired).padStart(6)}  ${String(
        p.orphans
      ).padStart(8)}  ${String(p.growthMB).padStart(7)} MB`
  );
}

// --- verdict --------------------------------------------------------------------
//
// ⚠️ THE FIRST VERSION OF THIS COMPARED last.orphans / first.orphans, and the
// first point has ZERO orphans by construction: at 20 rounds the 20-entry
// history still covers every round, so nothing has been evicted. Dividing by it
// gave Infinity and printed NOT CONFIRMED over data that confirms the
// hypothesis cleanly. A wrong statistic on a right experiment reads exactly like
// a result.
//
// What actually has to hold is three things, and none of them is a ratio to a
// boundary condition:
//
//   1. the OWNED set is bounded — the retained window can only claim so much
//   2. ORPHANS grow with total churn — eviction is not releasing them
//   3. the marginal heap per marginal orphan is stable and positive, so the
//      orphans ACCOUNT for the slope rather than merely accompanying it
const owned = points.map((p) => p.ownedRetired);
const ownedBounded = Math.max(...owned) / Math.max(1, Math.min(...owned)) < 1.5;

// Measure growth from the first point that HAS orphans, not from the boundary.
const withOrphans = points.filter((p) => p.orphans > 0);
const o0 = withOrphans[0];
const oN = withOrphans.at(-1);
const orphanRatio = o0 ? oN.orphans / o0.orphans : 0;
const orphanRoundRatio = o0 ? oN.rounds / o0.rounds : 0;
const orphansGrow = Boolean(o0) && orphanRatio > orphanRoundRatio / 2;

// Marginal cost: how much heap did each ADDITIONAL orphan bring with it?
const marginalBytesPerOrphan = o0
  ? ((oN.growthMB - o0.growthMB) * 1024 * 1024) / (oN.orphans - o0.orphans)
  : 0;
const orphanShareOfHeap = oN
  ? (oN.orphans * marginalBytesPerOrphan) / (oN.growthMB * 1024 * 1024)
  : 0;

console.log(
  `\n  owned retired subjects: ${Math.min(...owned)}-${Math.max(...owned)} ` +
    `(bounded: ${ownedBounded ? 'yes' : 'NO'})\n` +
    `  orphans ${o0?.orphans ?? 0} -> ${oN?.orphans ?? 0} over ` +
    `${orphanRoundRatio}x the rounds\n` +
    `  marginal cost per orphan: ${Math.round(marginalBytesPerOrphan)} B\n` +
    `  share of total growth attributable to orphans: ` +
    `${(orphanShareOfHeap * 100).toFixed(0)}%`
);

console.log('\nVERDICT');
const confirmed =
  ownedBounded && orphansGrow && marginalBytesPerOrphan > 0 && orphanShareOfHeap > 0.7;

if (confirmed) {
  console.log(
    '  CONFIRMED. The set a retained history window can restore is BOUNDED, and\n' +
      '  everything beyond it is retained anyway — orphans grow with total churn\n' +
      '  and account for essentially all of the heap slope.\n\n' +
      '  Eviction ends the restoration claim without releasing the backing. The\n' +
      '  fix belongs at the eviction boundary: release the evicted entry\'s\n' +
      '  claims, and reclaim a subject when its LAST claim goes.'
  );
} else {
  console.log(
    '  NOT CONFIRMED — orphaned retired subjects do not account for the slope on\n' +
      '  their own. STOP: find the remaining term before designing a claim\n' +
      '  registry against a hypothesis that has not survived.\n' +
      `  (owned bounded: ${ownedBounded}, orphans grow: ${orphansGrow}, ` +
      `share: ${(orphanShareOfHeap * 100).toFixed(0)}%)`
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(points, null, 2));
}

process.exit(confirmed ? 0 : 1);
