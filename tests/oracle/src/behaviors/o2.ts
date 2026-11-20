// O2 | **Turn atomicity for observers.** Every observer sees a turn (including
// undo, redo, rollback and one chunk of an ingest) as one change: it runs at
// most once per turn and never sees part of a turn applied. History state
// (`canUndo`, `canRedo`, position) changes in the same turn.
//
// Each operation is one turn. Three checks:
// (a) in a step that is a turn on its own (not same-tick with its
//     neighbours, no observer wrote reentrantly, no link or declaration work
//     can land in its drain), every `observe` observer that ran ran once;
// (b) in such a step, each run read the state the step left: the whole turn
//     applied, not part of it;
// (c) with restoration installed, a step that is not same-tick and changed
//     the history state (canUndo, canRedo, current index) already shows the
//     change as the operation returns, before anything else runs
//     (Observation.restorationAtReturn), so the change is in the operation's
//     own turn and not a later one.
// Chunked ingest is not in the published packages.
import type { Json, Op, StateView } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, destroyedAt, isAsyncKind, type StepInfo } from './analysis.js';
import { runsIn } from './o1.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  '**Turn atomicity for observers.** Every observer sees a turn (including undo, redo, rollback and one chunk of an ingest) as one change: it runs at most once per turn and never sees part of a turn applied. History state (`canUndo`, `canRedo`, position) changes in the same turn.';

/** Operations that publish exactly one turn and leave nothing to land later. */
const ONE_TURN = new Set<Op['kind']>(['write', 'transact', 'undo', 'redo', 'rollback', 'confirm', 'rowHeldWrite', 'linkPush']);

const view = (s: StateView | { readError: unknown }): string | undefined =>
  'readError' in s ? undefined : canonical({ a: s.a, cfg: s.cfg, rows: s.rows, ids: s.ids });

const history = (h: StepInfo['observation']['restoration']): Json | undefined =>
  h ? { canUndo: h.canUndo, canRedo: h.canRedo, index: h.index } : undefined;

export const O2 = instanceProperty({
  id: 'O2',
  row: ROW,
  clauses: {
    a: 'every observer runs at most once per turn',
    b: 'each run sees the whole turn applied',
    c: 'history state changes in the same turn',
  },
  reason: 'Chunked ingest is not in the published packages; history state is read as the operation returns, so its change is checked against the drain that follows.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const { steps } = trace.sequence;
    const destroyed = destroyedAt(analysis) ?? Infinity;
    for (const s of analysis.steps) {
      if (s.index >= destroyed) break;
      const alone = !steps[s.index]?.sameTick && !steps[s.index - 1]?.sameTick;
      const ran = s.outcome.status === 'ok' || s.outcome.status === 'error';
      if (alone && ran && !s.unknown && ONE_TURN.has(s.op.kind) && s.after) {
        const after = view(s.after);
        for (const o of analysis.observers) {
          if (o.step >= s.index) continue;
          const runs = runsIn([s], o.index);
          if (runs === 0) continue;
          const detail = `observer ${o.index} in the turn of step ${s.index}`;
          found.push(verdict(runs === 1, s.index, 'ran-twice-in-one-turn', { runs: 1 }, { runs }, detail, 'a'));
          const saw = (s.observation.observerEvents ?? []).flatMap((e) => (e.kind === 'run' && e.observer === o.index ? [view(e.saw)] : []));
          const partial = saw.filter((v) => v !== undefined && v !== after);
          if (after !== undefined && saw.some((v) => v !== undefined)) {
            found.push(
              verdict(
                partial.length === 0,
                s.index,
                'saw-part-of-turn',
                { saw: s.after as unknown as Json },
                { saw: partial.map((v) => JSON.parse(v as string) as Json) },
                `observer ${o.index} ran during the turn of step ${s.index}`,
                'b'
              )
            );
          }
        }
      }
      // (c) history state belongs to the operation's turn.
      const atReturn = history(s.observation.restorationAtReturn);
      const now = history(s.observation.restoration);
      const prior = history(analysis.trace.records[s.index - 1]?.observation.restoration);
      if (!atReturn || !now || !prior || steps[s.index]?.sameTick || s.unknown || !ran || isAsyncKind(s.op.kind)) continue;
      if (canonical(now) === canonical(prior)) continue;
      found.push(
        verdict(
          canonical(atReturn) === canonical(now),
          s.index,
          'history-changed-after-turn',
          { atReturn: now },
          { atReturn, afterDrain: now },
          `history state at step ${s.index} (${s.op.kind})`,
          'c'
        )
      );
    }
    return found;
  },
});
