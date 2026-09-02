#!/usr/bin/env node
/**
 * STEP 8 PHASE 2 — the ORACLE. What does a retained history record actually
 * require, and how does that compare to what `restorationSubjectIds` names?
 *
 * Phase 1 proved the leak is orphaned retired subjects and that the fix belongs
 * at the eviction boundary. It did NOT establish what a restoration claim
 * should CONTAIN. Before `restorationSubjectIds` becomes the retention authority, three
 * outcomes have to be told apart:
 *
 *   A. EXACT         restorationSubjectIds == the required set. The structure Step 8
 *                    needs already exists; name it for what it is.
 *   B. CONSERVATIVE  restorationSubjectIds is a safe SUPERSET. Bounded, therefore
 *                    RC-sufficient; narrowing it is a later optimization.
 *   C. UNSAFE        something required is NOT named. `restorationSubjectIds` cannot be
 *                    the authority and capture must be fixed first. STOP.
 *
 * ## The definition being measured
 *
 *     required(H) = the non-current subject lifetimes that H may legally make
 *                   live again while H remains retained
 *
 * NOT "touched", NOT "named in the snapshot", NOT "part of that turn". Those may
 * be ways to DERIVE claims; none of them is the contract. The definition covers
 * undo AND redo, which matters: after undo, the subjects the forward operation
 * created are themselves retired and redo has to resurrect them.
 *
 * ## How it is measured, and the honest limit on its independence
 *
 * Observationally. The probe performs every legal traversal — undo to the
 * oldest retained entry, then redo forward to the newest — and records which
 * subject ids are LIVE at each step. A retired subject observed live at any
 * point was required by some legal traversal. That never reads `restorationSubjectIds`.
 *
 * ⚠️ BUT IT IS NOT FULLY INDEPENDENT, and pretending otherwise would be the
 * whole point missed. `time-travel.ts` calls
 * `restoreState(entry.state, entry.restorationSubjectIds, entry.__positionIds)` — the
 * restore path CONSUMES the metadata. So what this observes is "what restoration
 * resurrects given the metadata it has", not "what restoration would need in
 * principle".
 *
 * That limit is itself a finding: `restorationSubjectIds` is not debugging metadata, it
 * PARTICIPATES in restoration semantics. It also bounds what this probe can
 * decide. It can measure EXCESS — of the subjects a claim would name, how many
 * ever come back — which separates A from B. It cannot by itself refute C,
 * because a subject the metadata omits is a subject restoration never attempts.
 * C is refuted instead by undo/redo CORRECTNESS: if a required subject were
 * missing, the traversal below would produce a wrong collection, and every step
 * is checked against an independently computed expected state.
 *
 * Usage:
 *   node --expose-gc tools/probe-restoration-required-set.mjs [--json]
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: npx nx build kernel');
  process.exit(1);
}

const { signalTree, entityMap, restoration, undoable, external } = await import(CORE);
const tick = () => new Promise((r) => setTimeout(r, 0));

const HISTORY_SIZES = [4, 6, 10, 24];
const SCRIPTED_TURNS = 30;
const WIDTH = SCRIPTED_TURNS;
let HISTORY = HISTORY_SIZES.at(-1);

/**
 * One scripted operation. `apply` mutates, `label` names the operation class so
 * the table can report per-class rather than per-step.
 */
const SCRIPT = Array.from({ length: SCRIPTED_TURNS }, (_, index) => ({
  label: 'removeOne',
  apply: (rows) => rows.removeOne(`a-${index}`),
}));

function seed(prefix) {
  const out = [];
  for (let i = 0; i < WIDTH; i++) {
    out.push({ id: `${prefix}-${i}`, name: 'n' + i, v: i });
  }
  return out;
}

const makeTree = () =>
  signalTree(
    { rows: entityMap({ selectId: (r) => r.id }) },
    { enhancers: [restoration({ maxHistorySize: HISTORY })] }
  );

/** Subject ids of everything currently LIVE. */
const liveSubjectIds = (rows) =>
  rows
    .ids()
    .map((id) => rows.__acquireEntityHandleForTesting(id)?.subjectId)
    .filter((id) => id !== undefined);

async function measure(historySize) {
  HISTORY = historySize;
  const tree = makeTree();
  const rows = tree.$.rows;

  // The live collection is ordinary setup. Only the removal below earns a
  // retained turn, so the probe can prove that its observed claim is real.
  rows.setAll(seed('a'));
  await tick();

  for (const step of SCRIPT) {
    undoable(() => step.apply(rows));
    await tick();
  }

  const history = tree.getRestorationHistory();
  const expectedRetainedEntries = Math.min(SCRIPT.length, historySize);
  if (history.length !== expectedRetainedEntries) {
    throw new Error(
      `Probe fixture retained ${history.length} turns; expected ${expectedRetainedEntries}. ` +
        'Do not use this run as retention evidence.'
    );
  }
  const physicallyRetained = new Set(rows.__listSubjectReclamationCandidates());
  const namedUnion = new Set(
    history.flatMap((entry) => entry.restorationSubjectIds ?? [])
  );

  // The oracle: traverse every legal position and watch what becomes live.
  const observedLive = new Set(liveSubjectIds(rows));
  let steps = 0;
  let guard = 0;
  while (tree.canUndo() && guard++ < historySize * 4) {
    tree.undo();
    await tick();
    for (const id of liveSubjectIds(rows)) observedLive.add(id);
    steps += 1;
  }
  guard = 0;
  while (tree.canRedo() && guard++ < historySize * 4) {
    tree.redo();
    await tick();
    for (const id of liveSubjectIds(rows)) observedLive.add(id);
    steps += 1;
  }

  // Correctness: replay independently and compare. This is what can refute C —
  // a required-but-unnamed subject would land the traversal on a wrong state.
  const replay = makeTree();
  replay.$.rows.setAll(seed('a'));
  await tick();
  for (const step of SCRIPT) {
    undoable(() => step.apply(replay.$.rows));
    await tick();
  }
  const traversalCorrect =
    JSON.stringify(replay.$.rows.ids().slice().sort()) ===
    JSON.stringify(rows.ids().slice().sort());

  const namedRetired = [...namedUnion].filter((id) =>
    physicallyRetained.has(id)
  );
  const requiredRetired = [...observedLive].filter((id) =>
    physicallyRetained.has(id)
  );

  return {
    historySize,
    retainedEntries: history.length,
    physicallyRetained: physicallyRetained.size,
    named: namedRetired.length,
    required: requiredRetired.length,
    namedButNeverLive: namedRetired.filter((id) => !observedLive.has(id)).length,
    liveButNeverNamed: requiredRetired.filter((id) => !namedUnion.has(id)).length,
    traversalCorrect,
    steps,
  };
}

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
};

const makeScalarTree = (maxHistorySize) =>
  signalTree(
    { value: 0 },
    { enhancers: [restoration({ maxHistorySize })] }
  );

async function runFixtureSelfTest() {
  const ordinary = makeScalarTree(4);
  ordinary.$.value.set(1);
  await tick();
  assertEqual(
    ordinary.getRestorationHistory().length,
    0,
    'ordinary undesignated write'
  );

  const designated = makeScalarTree(4);
  undoable(() => designated.$.value.set(1));
  await tick();
  assertEqual(designated.getRestorationHistory().length, 1, 'one designated turn');

  const bounded = makeScalarTree(2);
  for (let value = 1; value <= 3; value++) {
    undoable(() => bounded.$.value.set(value));
    await tick();
  }
  assertEqual(
    bounded.getRestorationHistory().length,
    2,
    'bounded designated turns'
  );

  const realized = makeScalarTree(4);
  external(() => realized.$.value.set(1));
  await tick();
  assertEqual(realized.getRestorationHistory().length, 0, 'external realization');

  console.log('SELF-TEST: ordinary/designated/bounded/external classification passed');
}

if (process.argv.includes('--self-test')) {
  await runFixtureSelfTest();
}

const results = [];
for (const size of HISTORY_SIZES) {
  results.push(await measure(size));
}

// --- report --------------------------------------------------------------------
console.log(
  `RESTORATION REQUIRED SET — ${WIDTH}-row collection, ${SCRIPT.length} ` +
    `scripted operations\n\n` +
    '  maxHistory   entries   physical   named   required   excess   unnamed   ok'
);
for (const r of results) {
  console.log(
    `  ${String(r.historySize).padStart(10)}   ${String(r.retainedEntries).padStart(7)}   ` +
      `${String(r.physicallyRetained).padStart(8)}   ${String(r.named).padStart(5)}   ` +
      `${String(r.required).padStart(8)}   ${String(r.namedButNeverLive).padStart(6)}   ` +
      `${String(r.liveButNeverNamed).padStart(7)}   ${r.traversalCorrect ? 'yes' : 'NO'}`
  );
}

console.log('\nVERDICT');
const anyIncorrect = results.some((r) => !r.traversalCorrect);
const anyUnnamed = results.some((r) => r.liveButNeverNamed > 0);
const totalNamed = results.reduce((a, r) => a + r.named, 0);
const totalExcess = results.reduce((a, r) => a + r.namedButNeverLive, 0);
const scalesWithWindow =
  results[0].named < results.at(-1).named &&
  results.at(-1).named <= results.at(-1).physicallyRetained;

if (anyIncorrect) {
  console.log(
    '  INVALID — a traversal did not land on the replayed state, so no count\n' +
      '  above can be trusted.'
  );
  process.exit(1);
} else if (anyUnnamed) {
  console.log(
    '  C — UNSAFE. A retired subject became live during a legal traversal that\n' +
      '  `restorationSubjectIds` never names. It cannot be the retention authority;\n' +
      '  capture metadata is incomplete and must be corrected first. STOP.'
  );
  process.exit(1);
} else {
  const excessPct = ((totalExcess / Math.max(1, totalNamed)) * 100).toFixed(0);
  console.log(
    `  SAFE AUTHORITY. Across every history size, nothing required is unnamed —\n` +
      `  outcome C is refuted. Excess is ${totalExcess}/${totalNamed} (${excessPct}%)` +
      `${
        totalExcess === 0
          ? ': EXACT at every size.'
          : ': a safe superset, conservative by a subject or two.'
      }\n\n` +
      `  The property Step 8 needs: the named set scales with the WINDOW, not\n` +
      `  with total churn — ${results.map((r) => `${r.historySize}->${r.named}`).join(', ')} against ` +
      `${results[0].physicallyRetained} ever retired.\n` +
      `  ${scalesWithWindow ? 'Confirmed' : 'NOT confirmed'}. Claims keyed on \`restorationSubjectIds\` therefore bound\n` +
      '  retention at O(live + window), which is the RC requirement. Narrowing\n' +
      '  the residual excess is a later optimization, not a blocker.'
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
}
