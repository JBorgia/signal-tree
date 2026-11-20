// R3 | Undo after a confirmed transaction reverses that transaction's
// undoable writes as one operation, or refuses whole per R2. An undo entry
// whose transaction was rolled back has nothing to reverse: undo skips it and
// removes it from history. Redo re-applies exactly what undo reversed, or
// refuses whole if a newer write would be overwritten.
//
// (a) At an undo() whose most recent undoable operation is an undoable
//     transaction confirmed before it, with no undo() or redo() succeeding in
//     between: when no newer write still stands on the transaction's
//     locations, undo() succeeds and every location the transaction changed
//     is back to its value before the transaction, all in that one call; when
//     a newer write stands and undoing would put a different value there, it
//     refuses (throws) and changes nothing (R2).
// (b) At an undo() whose most recent undoable operation is an undoable
//     transaction rolled back before it: when the history shows that
//     transaction's entry (the history grew by one at the step that opened it
//     and stayed so until this undo), undo() removes it, so the history is at
//     least one entry shorter afterwards. Nothing else about that call is
//     asserted.
// (c) At a redo() whose most recent successful undo()/redo() is an undo(),
//     with no undoable operation in between, and where every location that
//     undo changed was last written by an undoable operation or a redo (so
//     what it reversed is one operation, not a write it overwrote, which is
//     R2's matter): when no newer write still
//     stands on the locations that undo changed, redo() succeeds, gives each
//     of them back the value it had before the undo, and changes nothing
//     else; when one stands and redoing would put a different value there,
//     it refuses (throws) and changes nothing.
//
// Left open by the row, so not checked: an undo or redo while a pending
// transaction has changed any of the locations involved; a newer write that
// left the value it would be restored to (R2 reads "overwrite" the same way);
// a step that rewrote a location without changing it; history observed
// mid-turn.
import type { Json } from '../model.js';
import { canonical } from '../trace.js';
import {
  analyze,
  intersection,
  intersects,
  locValues,
  txStatus,
  type Analysis,
  type Loc,
  type StepInfo,
} from './analysis.js';
import { names } from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "Undo after a confirmed transaction reverses that transaction's undoable writes as one operation, or refuses whole per R2. An undo entry whose transaction was rolled back has nothing to reverse: undo skips it and removes it from history. Redo re-applies exactly what undo reversed, or refuses whole if a newer write would be overwritten.";

const ABSENT = 'absent';
const ran = (s: StepInfo) => s.outcome.status === 'ok' || s.outcome.status === 'error';
const marked = (s: StepInfo) => (s.op.kind === 'write' && s.op.wrap === 'undoable') || (s.op.kind === 'transact' && s.op.undoable);
const succeeded = (s: StepInfo, kind: 'undo' | 'redo') => s.op.kind === kind && s.outcome.status === 'ok';

/**
 * Steps strictly between `from` and `until` whose changes to `locs` still
 * stand at `until`. Undefined when the rows leave it open: a step that
 * rewrote one of `locs` without changing it, an unreadable step, a
 * compensation for a transaction opened before `from`, or an undo, redo or
 * confirm that changed them.
 */
function newerWrites(a: Analysis, from: number, until: number, locs: ReadonlySet<Loc>): StepInfo[] | undefined {
  const newer: StepInfo[] = [];
  for (const s of a.steps.slice(from + 1, until)) {
    if (s.unknown) return undefined;
    const hit = intersection(s.changed, locs);
    if ([...locs].some((loc) => !hit.has(loc) && names(s.op, s.outcome.status, loc))) return undefined;
    if (hit.size === 0) continue;
    if (s.op.kind === 'rollback' && s.outcome.status === 'ok' && s.tx !== undefined) {
      if ((a.txs[s.tx]?.step ?? -1) > from) continue; // its transaction's write, also after `from`, no longer stands
      return undefined;
    }
    if (s.op.kind === 'transact' && s.tx !== undefined) {
      const tx = a.txs[s.tx];
      if (tx && txStatus(tx, until) === 'rolledBack') continue;
    }
    if (s.op.kind === 'undo' || s.op.kind === 'redo' || s.op.kind === 'confirm') return undefined;
    newer.push(s);
  }
  return newer;
}

const pendingOn = (a: Analysis, at: number, locs: ReadonlySet<Loc>) =>
  a.txs.some((t) => txStatus(t, at) === 'pending' && (t.unknown || intersects(t.changed, locs)));

const read = (v: string | undefined): Json => (v === undefined ? ABSENT : (JSON.parse(v) as Json));

/** The outcome of an undo or redo against the value it should restore at each location. */
function restoreVerdict(
  clause: 'a' | 'c',
  s: StepInfo,
  locs: ReadonlySet<Loc>,
  restoresTo: ReturnType<typeof locValues>,
  newer: readonly StepInfo[],
  detail: string
): Instance | undefined {
  if (!s.before || !s.after) return undefined;
  const now = locValues(s.before);
  const after = locValues(s.after);
  if (!now.rowsKnown || !after.rowsKnown || !restoresTo.rowsKnown) return undefined;
  const status = s.outcome.status === 'ok' ? 'ok' : 'refused';
  const verb = clause === 'a' ? 'undo' : 'redo';
  if (newer.length === 0) {
    const expected: Record<string, Json> = {};
    const observed: Record<string, Json> = {};
    let same = true;
    for (const loc of locs) {
      expected[loc] = read(restoresTo.values.get(loc));
      observed[loc] = read(after.values.get(loc));
      if (restoresTo.values.get(loc) !== after.values.get(loc)) same = false;
    }
    // Redo re-applies exactly what undo reversed: nothing outside it changes.
    const outside = clause === 'c' ? [...s.changed].filter((loc) => !locs.has(loc)) : [];
    const ok = status === 'ok' && same && outside.length === 0;
    return verdict(
      ok,
      s.index,
      status === 'ok' ? `${clause}-${verb}-not-exact` : `${clause}-${verb}-refused-without-newer-write`,
      { status: 'ok', state: expected, ...(clause === 'c' ? { changesOutside: [] } : {}) },
      { status, state: observed, ...(clause === 'c' ? { changesOutside: outside } : {}) },
      detail
    );
  }
  const overwritten = new Set(newer.flatMap((n) => [...intersection(n.changed, locs)]));
  if (![...overwritten].some((loc) => now.values.get(loc) !== restoresTo.values.get(loc))) return undefined;
  const unchanged = canonical(s.before) === canonical(s.after);
  return verdict(
    status === 'refused' && unchanged,
    s.index,
    status === 'refused' ? `${clause}-${verb}-refusal-changed-state` : `${clause}-${verb}-over-newer-write`,
    { status: 'refused', state: s.before as unknown as Json },
    { status, state: s.after as unknown as Json },
    `${detail}; newer write at step ${newer.map((n) => n.index).join(', ')}`
  );
}

/** restoration.length recorded after step `i` (0 before the first step), or undefined when unreadable. */
function historyLength(a: Analysis, i: number): number | undefined {
  if (i < 0) return 0;
  const value = a.trace.records[i]?.observation.restoration?.length;
  return typeof value === 'number' ? value : undefined;
}

export const R3 = instanceProperty({
  id: 'R3',
  row: ROW,
  reason:
    '"Nothing of it is reversed" (clause b) is not observable: after the rollback its locations already hold their earlier values, and reversing it once later writes moved them looks the same as undoing those writes (R1). Clause b\'s history check needs the subject to show the entry; a subject that never records an entry for an unsettled transaction is not reached by it. Undo or redo while a pending transaction has changed the locations involved is not checked.',
  instances(trace) {
    const analysis = analyze(trace);
    const { steps } = trace.sequence;
    const found: Instance[] = [];
    for (const s of analysis.steps) {
      if (!ran(s) || s.unknown) continue;
      const prior = analysis.steps.slice(0, s.index);

      if (s.op.kind === 'undo') {
        const last = [...prior].reverse().find((p) => marked(p) && ran(p));
        if (!last || last.op.kind !== 'transact' || last.tx === undefined) continue;
        const tx = analysis.txs[last.tx];
        if (!tx || tx.unknown || tx.changed.size === 0) continue;
        if (prior.slice(tx.step + 1).some((p) => succeeded(p, 'undo') || succeeded(p, 'redo'))) continue;
        const status = txStatus(tx, s.index);

        if (status === 'confirmed') {
          if (steps[tx.step - 1]?.sameTick || pendingOn(analysis, s.index, tx.changed)) continue;
          const opened = analysis.steps[tx.step]?.before;
          const newer = newerWrites(analysis, tx.step, s.index, tx.changed);
          if (!opened || !newer) continue;
          const v = restoreVerdict('a', s, tx.changed, locValues(opened), newer, `undo() at step ${s.index} after tx${tx.index} was confirmed`);
          if (v) found.push(v);
        } else if (status === 'rolledBack') {
          // The entry shows: the history grew by one when the transaction opened and held until this undo.
          const atTurnEnds = [tx.step - 1, tx.step, s.index - 1, s.index].every((i) => i < 0 || !steps[i]?.sameTick);
          const lengths = prior.slice(tx.step).map((p) => historyLength(analysis, p.index));
          const opened = historyLength(analysis, tx.step);
          const before = historyLength(analysis, tx.step - 1);
          const after = historyLength(analysis, s.index);
          if (!atTurnEnds || opened === undefined || before === undefined || opened !== before + 1) continue;
          if (!lengths.every((l) => l === opened)) continue;
          found.push(
            verdict(
              after !== undefined && after <= opened - 1,
              s.index,
              'b-rolled-back-entry-kept',
              { historyLength: `at most ${opened - 1}` },
              { historyLength: after ?? null },
              `undo() at step ${s.index}: the entry of tx${tx.index}, rolled back at step ${tx.settled?.step}, is in history`
            )
          );
        }
        continue;
      }

      if (s.op.kind === 'redo') {
        const last = [...prior].reverse().find((p) => succeeded(p, 'undo') || succeeded(p, 'redo'));
        if (!last || last.op.kind !== 'undo' || last.unknown || steps[last.index]?.sameTick || !last.before) continue;
        if (prior.slice(last.index + 1).some((p) => marked(p) && ran(p))) continue;
        const reversed = last.changed;
        if (reversed.size === 0 || pendingOn(analysis, s.index, reversed)) continue;
        const lastWriter = (loc: Loc) => [...prior.slice(0, last.index)].reverse().find((p) => p.unknown || p.changed.has(loc));
        const fromOperations = [...reversed].every((loc) => {
          const w = lastWriter(loc);
          return w !== undefined && !w.unknown && ((marked(w) && ran(w)) || succeeded(w, 'redo'));
        });
        if (!fromOperations) continue;
        const newer = newerWrites(analysis, last.index, s.index, reversed);
        if (!newer) continue;
        const v = restoreVerdict('c', s, reversed, locValues(last.before), newer, `redo() at step ${s.index} after undo() at step ${last.index}`);
        if (v) found.push(v);
      }
    }
    return found;
  },
});
