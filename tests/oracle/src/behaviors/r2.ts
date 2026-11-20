// R2 | Undo refuses the whole operation and changes nothing if any write after
// it, by any writer, touched a location it changed (as defined in T4)
//
// Applies where the history is fixed by the trace alone: every undoable
// operation so far is a top-level undoable() write that changed something,
// and no redo() has succeeded (R3 covers undo around transactions). The
// operation undo() targets is the most recent one not undone; the locations
// it changed are T4's (analysis.ts changedLocations: a replace, or a setAll
// that keeps a key, changes the row's existence). When a later write that
// still stands (not itself undone, not a rolled-back transaction or a
// rollback's compensation) touched a location overlapping one it changed, in
// T4's terms (analysis.ts Touches: unread overwrites, the value
// already there unless the seam skipped it, re-inserts, setAll and clear,
// same-turn writes and inbound link values all count), undo() must refuse
// (throw) and change nothing. Skipped, because what the later step touched
// cannot be seen: a step whose state could not be read, whose writes do not
// reproduce the state it left, or whose touch on those locations is only
// possible (an inbound link value that would leave the state as it was).
import type { Json } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, changedLocations, names, overlapping, txStatus, type Loc } from './analysis.js';
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
        if (outcome.status !== 'ok' || s.unknown || !s.touches || s.changed.size === 0) fixed = false;
        else stack.push({ step: s.index, locs: changedLocations(s.changed, s.touches) });
        continue;
      }
      if (op.kind !== 'undo' || !ran) continue;
      const target = stack[stack.length - 1];
      if (fixed && target) {
        const between = analysis.steps.slice(target.step + 1, s.index);
        let open = between.some((b) => b.unknown);
        const newer: { step: number; locs: Set<Loc> }[] = [];
        for (const b of between) {
          if (open) break;
          if (undone.has(b.index) || b.op.kind === 'undo' || b.op.kind === 'redo') continue;
          if (b.op.kind === 'rollback' && b.outcome.status === 'ok') continue;
          if (b.op.kind === 'transact' && b.tx !== undefined) {
            const tx = analysis.txs[b.tx];
            if (tx && txStatus(tx, s.index) === 'rolledBack') continue;
          }
          const t = b.touches;
          if (!t) {
            open = overlapping(b.changed, target.locs).size > 0 || [...target.locs].some((loc) => names(b.op, b.outcome.status, loc));
            continue;
          }
          const hit = overlapping(t.sure, target.locs);
          if ([...overlapping(t.maybe, target.locs)].some((loc) => !hit.has(loc))) open = true;
          else if (hit.size > 0) newer.push({ step: b.index, locs: hit });
        }
        if (!open && newer.length > 0 && !s.unknown && s.before && s.after) {
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
              `undo() at step ${s.index} targets step ${target.step}; step ${newer
                .map((n) => `${n.step} touched ${[...n.locs].join(', ')}`)
                .join('; step ')}`
            )
          );
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
