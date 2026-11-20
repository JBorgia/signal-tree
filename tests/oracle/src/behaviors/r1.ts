// R1 | Undo applies only to operations marked undoable() and requires
// restoration()
//
// At every undo() that succeeds, the locations it changed must all have been
// changed by an earlier operation marked undoable (an undoable() write or an
// undoable transaction); with none, undo() changes nothing.
import { analyze, type Loc } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW = 'Undo applies only to operations marked undoable() and requires restoration()';

export const R1 = instanceProperty({
  id: 'R1',
  row: ROW,
  reason:
    '"Requires restoration()" is not checked: without restoration() the runner skips undo, so no subject is asked to undo.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const undoable = new Set<Loc>();
    let known = true;
    for (const s of analysis.steps) {
      const marked =
        (s.op.kind === 'write' && s.op.wrap === 'undoable') || (s.op.kind === 'transact' && s.op.undoable);
      if (marked && s.outcome.status !== 'skipped' && s.outcome.status !== 'unsupported') {
        if (s.unknown) known = false;
        for (const loc of s.changed) undoable.add(loc);
      }
      if (s.op.kind !== 'undo' || s.outcome.status !== 'ok' || !known || s.unknown) continue;
      const outside = [...s.changed].filter((loc) => !undoable.has(loc));
      found.push(
        verdict(
          outside.length === 0,
          s.index,
          'undid-unmarked-write',
          { changesOnlyAmong: [...undoable] },
          { changed: [...s.changed], outsideUndoable: outside },
          `undo() at step ${s.index}`
        )
      );
    }
    return found;
  },
});
