// W5 | **Synchronous context.** A writer context and turn membership never
// carry across an `await`. Async work captures its context explicitly, as the
// ingest handle does (ruling 6).
//
// An awaiting scope (model.ts scopeAwait) runs `before`, awaits, then runs
// `after` inside transact() or undoable(). The writes after the await are not
// members of the scope's turn. Of the locations `after` touched, the ones
// `before` did not touch (by T4's overlap) are checked:
// (a) transact: when the transaction is rolled back, those locations keep
//     the value they had before the rollback;
// (b) undoable: when the next undo() reverses the scope's history entry (the
//     history grew by one at the scope and nothing was undone, redone or
//     newly made undoable since), it leaves those locations as they were.
// Either check is skipped when another step touched those locations in
// between, or its touches cannot be seen. The writer-context half is not
// checked: the published packages have no writer identity, and the scope's
// own result (a transaction, or undoable() refusing an async scope) is not
// constrained by the row.
import type { Json } from '../model.js';
import {
  analyze,
  destroyedAt,
  locValues,
  overlapping,
  overlapsAny,
  touchesOfGroups,
  type Analysis,
  type Loc,
  type StepInfo,
} from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  '**Synchronous context.** A writer context and turn membership never carry across an `await`. Async work captures its context explicitly, as the ingest handle does (ruling 6).';

const marked = (s: StepInfo) =>
  (s.op.kind === 'write' && s.op.wrap === 'undoable') ||
  (s.op.kind === 'transact' && s.op.undoable) ||
  (s.op.kind === 'scopeAwait' && s.op.scope === 'undoable');
const historyLength = (a: Analysis, i: number): number | undefined => {
  if (i < 0) return 0;
  const v = a.trace.records[i]?.observation.restoration?.length;
  return typeof v === 'number' ? v : undefined;
};

/** Whether any step strictly between `from` and `to` touched, or may have touched, `locs`. */
function touchedBetween(a: Analysis, from: number, to: number, locs: ReadonlySet<Loc>): boolean {
  return a.steps.slice(from + 1, to).some((b) => {
    if (b.unknown || !b.touches) return true;
    return overlapping([...b.touches.sure, ...b.touches.maybe, ...b.changed], locs).size > 0;
  });
}

/** The values of `locs` before and after step `s`, and whether the step changed any. */
function unchangedBy(
  s: StepInfo,
  locs: ReadonlySet<Loc>
): { ok: boolean; expected: Record<string, Json>; observed: Record<string, Json> } | undefined {
  if (!s.before || !s.after) return undefined;
  const before = locValues(s.before);
  const after = locValues(s.after);
  if (!before.rowsKnown || !after.rowsKnown) return undefined;
  const read = (v: string | undefined): Json => (v === undefined ? 'absent' : (JSON.parse(v) as Json));
  const expected: Record<string, Json> = {};
  const observed: Record<string, Json> = {};
  let ok = true;
  for (const loc of locs) {
    expected[loc] = read(before.values.get(loc));
    observed[loc] = read(after.values.get(loc));
    if (before.values.get(loc) !== after.values.get(loc)) ok = false;
  }
  return { ok, expected, observed };
}

export const W5 = instanceProperty({
  id: 'W5',
  row: ROW,
  clauses: {
    a: 'transact: rollback keeps writes made after the await',
    b: 'undoable: undo keeps writes made after the await',
  },
  reason: 'Turn membership is checked through transact() and undoable(); the writer-context half needs writer identity, which the published packages lack.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const destroyed = destroyedAt(analysis) ?? Infinity;
    for (const s of analysis.steps) {
      if (s.op.kind !== 'scopeAwait' || s.unknown || s.index >= destroyed) continue;
      if (s.outcome.status !== 'ok' && s.outcome.status !== 'error') continue;
      const groups = touchesOfGroups(s.before, s.after, [s.op.before, s.op.after]);
      if (!groups) continue;
      const [before, after] = groups as [Set<Loc>, Set<Loc>];
      const afterOnly = new Set([...after].filter((loc) => !overlapsAny([loc], before)));
      if (afterOnly.size === 0) continue;
      let at: StepInfo | undefined;
      if (s.op.scope === 'transact') {
        const tx = s.tx === undefined ? undefined : analysis.txs[s.tx];
        if (!tx?.settled || tx.settled.how !== 'rolledBack') continue;
        at = analysis.steps[tx.settled.step];
      } else {
        const grew = historyLength(analysis, s.index - 1);
        if (grew === undefined || historyLength(analysis, s.index) !== grew + 1) continue;
        const later = analysis.steps.slice(s.index + 1, destroyed);
        const end = later.findIndex((b) => marked(b) || b.op.kind === 'undo' || b.op.kind === 'redo');
        const undo = end < 0 ? undefined : later[end];
        if (!undo || undo.op.kind !== 'undo' || undo.outcome.status !== 'ok') continue;
        at = undo;
      }
      if (!at || at.unknown || at.index >= destroyed || touchedBetween(analysis, s.index, at.index, afterOnly)) continue;
      const kept = unchangedBy(at, afterOnly);
      if (!kept) continue;
      found.push(
        verdict(
          kept.ok,
          at.index,
          s.op.scope === 'transact' ? 'rollback-reversed-write-after-await' : 'undo-reversed-write-after-await',
          { state: kept.expected },
          { state: kept.observed },
          `${at.op.kind}() at step ${at.index} of the ${s.op.scope}() scope at step ${s.index}, ` +
            `which wrote ${[...afterOnly].join(', ')} after its await`,
            s.op.scope === 'transact' ? 'a' : 'b'
        )
      );
    }
    return found;
  },
});
