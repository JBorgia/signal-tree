// R2 | Undo refuses the whole operation and changes nothing if any write after
// it, by any writer, touched a location it changed (as defined in T4)
//
// Applies where the history is fixed by the trace alone: every undoable
// operation so far is a top-level undoable() write that changed something,
// and no redo() has succeeded (R3 covers undo around transactions). The
// operation undo() targets is the most recent one not undone. When a later
// write that still stands (not itself undone, not a rolled-back transaction
// or a rollback's compensation) changed one of its locations, and undoing
// would put a different value there than the one that write left, undo()
// must refuse (throw) and change nothing. (Restoring the value a newer write
// also left overwrites nothing visible; the row does not say which way that
// goes, so it is not checked.)
import type { Json } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, intersection, locValues, txStatus, type Loc } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'Undo refuses the whole operation and changes nothing if any write after it, by any writer, touched a location it changed (as defined in T4)';

interface Entry {
  readonly step: number;
  readonly locs: ReadonlySet<Loc>;
}

export const R2 = instanceProperty({
  id: 'R2',
  row: ROW,
  reason: 'Checked only for histories of top-level undoable() writes with no redo(); undo around transactions is R3.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const stack: Entry[] = [];
    const undone = new Set<number>();
    let fixed = true;
    for (const s of analysis.steps) {
      const { op, outcome } = s;
      const ran = outcome.status === 'ok' || outcome.status === 'error';
      if (op.kind === 'transact' && op.undoable && ran) fixed = false;
      if (op.kind === 'redo' && outcome.status === 'ok') fixed = false;
      if (op.kind === 'write' && op.wrap === 'undoable' && ran) {
        if (outcome.status !== 'ok' || s.unknown || s.changed.size === 0) fixed = false;
        else stack.push({ step: s.index, locs: s.changed });
        continue;
      }
      if (op.kind !== 'undo' || !ran) continue;
      const target = stack[stack.length - 1];
      if (fixed && target) {
        const between = analysis.steps.slice(target.step + 1, s.index);
        if (between.every((b) => !b.unknown)) {
          const newer = between.filter((b) => {
            if (undone.has(b.index) || b.op.kind === 'undo' || b.op.kind === 'redo') return false;
            if (b.op.kind === 'rollback' && b.outcome.status === 'ok') return false;
            if (b.op.kind === 'transact' && b.tx !== undefined) {
              const tx = analysis.txs[b.tx];
              if (tx && txStatus(tx, s.index) === 'rolledBack') return false;
            }
            return intersection(b.changed, target.locs).size > 0;
          });
          const overwritten = new Set(newer.flatMap((b) => [...intersection(b.changed, target.locs)]));
          const restores = analysis.steps[target.step]?.before;
          const now = s.before && locValues(s.before);
          const then = restores && locValues(restores);
          const differs = !!now && !!then && [...overwritten].some((loc) => now.values.get(loc) !== then.values.get(loc));
          if (newer.length > 0 && differs && !s.unknown && s.before && s.after) {
            const unchanged = canonical(s.before) === canonical(s.after);
            const refused = outcome.status === 'error';
            found.push(
              verdict(
                refused && unchanged,
                s.index,
                refused ? 'refusal-changed-state' : 'overwrote-newer-write',
                { status: 'refused', state: s.before as unknown as Json },
                {
                  status: refused ? 'refused' : 'ok',
                  ...(refused ? { error: outcome.error.class } : {}),
                  state: s.after as unknown as Json,
                },
                `undo() at step ${s.index} targets step ${target.step}, overwritten at step ${newer.map((b) => b.index).join(', ')}`
              )
            );
          }
        }
      }
      if (outcome.status === 'ok' && target) {
        stack.pop();
        undone.add(target.step);
      } else if (outcome.status === 'ok' && (s.unknown || s.changed.size > 0)) {
        // It undid something this model does not know of.
        fixed = false;
      }
    }
    return found;
  },
});
