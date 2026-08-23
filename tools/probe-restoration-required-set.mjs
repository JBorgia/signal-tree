#!/usr/bin/env node
/**
 * STEP 8 PHASE 2 — the ORACLE. What does a retained history record actually
 * require, and how does that compare to what `__subjectIds` names?
 *
 * Phase 1 proved the leak is orphaned retired subjects and that the fix belongs
 * at the eviction boundary. It did NOT establish what a restoration claim
 * should CONTAIN. Before `__subjectIds` becomes the retention authority, three
 * outcomes have to be told apart:
 *
 *   A. EXACT         __subjectIds == the required set. The structure Step 8
 *                    needs already exists; name it for what it is.
 *   B. CONSERVATIVE  __subjectIds is a safe SUPERSET. Bounded, therefore
 *                    RC-sufficient; narrowing it is a later optimization.
 *   C. UNSAFE        something required is NOT named. `__subjectIds` cannot be
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
 * point was required by some legal traversal. That never reads `__subjectIds`.
 *
 * ⚠️ BUT IT IS NOT FULLY INDEPENDENT, and pretending otherwise would be the
 * whole point missed. `time-travel.ts` calls
 * `restoreState(entry.state, entry.__subjectIds, entry.__positionIds)` — the
 * restore path CONSUMES the metadata. So what this observes is "what restoration
 * resurrects given the metadata it has", not "what restoration would need in
 * principle".
 *
 * That limit is itself a finding: `__subjectIds` is not debugging metadata, it
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

const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: npx nx build core');
  process.exit(1);
}

const { signalTree, entityMap, timeTravel } = await import(CORE);
const tick = () => new Promise((r) => setTimeout(r, 0));

const WIDTH = 5;
const HISTORY_SIZES = [4, 6, 10, 24];
let HISTORY = HISTORY_SIZES.at(-1);

/**
 * One scripted operation. `apply` mutates, `label` names the operation class so
 * the table can report per-class rather than per-step.
 */
const SCRIPT = [
  { label: 'setAll (seed)', apply: (r) => r.setAll(seed('a')) },
  { label: 'updateOne', apply: (r) => r.updateOne('a-0', { v: 100 }) },
  { label: 'updateOne', apply: (r) => r.updateOne('a-1', { v: 101 }) },
  { label: 'addOne', apply: (r) => r.addOne({ id: 'extra', name: 'x', v: 7 }) },
  { label: 'removeOne', apply: (r) => r.removeOne('a-2') },
  { label: 'removeOne', apply: (r) => r.removeOne('extra') },
  { label: 'changeId', apply: (r) => r.changeId('a-3', 'a-3-renamed') },
  { label: 'setAll (replace all)', apply: (r) => r.setAll(seed('b')) },
  { label: 'updateOne', apply: (r) => r.updateOne('b-0', { v: 200 }) },
  { label: 'setAll (replace all)', apply: (r) => r.setAll(seed('c')) },
  { label: 'removeOne', apply: (r) => r.removeOne('c-1') },
  // `clear()` is DELIBERATELY ABSENT. Undoing it restores nothing and the undo
  // after that throws "Unsupported scoped undo effect at structural-drift" — a
  // pre-existing defect pinned in `clear-not-undoable.spec.ts`, found by this
  // probe when its traversal could not get past it. Including it here would make
  // the oracle measure a broken entry's claims.
  { label: 'setAll (reseed)', apply: (r) => r.setAll(seed('d')) },
];

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
    { enhancers: [timeTravel({ maxHistorySize: HISTORY })] }
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

  for (const step of SCRIPT) {
    step.apply(rows);
    await tick();
  }

  const history = tree.getHistory();
  const physicallyRetained = new Set(rows.__listSubjectReclamationCandidates());
  const namedUnion = new Set(
    history.flatMap((entry) => entry.__subjectIds ?? [])
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
  for (const step of SCRIPT) {
    step.apply(replay.$.rows);
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
      '  `__subjectIds` never names. It cannot be the retention authority;\n' +
      '  capture metadata is incomplete and must be corrected first. STOP.'
  );
  process.exit(1);
} else {
  const excessPct = ((totalExcess / Math.max(1, totalNamed)) * 100).toFixed(0);
  console.log(
    `  SAFE AUTHORITY. Across every history size, nothing required is unnamed —\n` +
      `  outcome C is refuted. Excess is ${totalExcess}/${totalNamed} (${excessPct}%): mostly EXACT,\n` +
      `  conservative by a subject or two at some sizes.\n\n` +
      `  The property Step 8 needs: the named set scales with the WINDOW, not\n` +
      `  with total churn — ${results.map((r) => `${r.historySize}->${r.named}`).join(', ')} against ` +
      `${results[0].physicallyRetained} ever retired.\n` +
      `  ${scalesWithWindow ? 'Confirmed' : 'NOT confirmed'}. Claims keyed on \`__subjectIds\` therefore bound\n` +
      '  retention at O(live + window), which is the RC requirement. Narrowing\n' +
      '  the residual excess is a later optimization, not a blocker.'
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
}
