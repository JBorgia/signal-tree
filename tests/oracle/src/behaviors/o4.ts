// O4 | **Reentrant writes.** A write made by an observer while a turn is being
// published is applied after that turn as its own turn, attributed to the
// observer's writer context. It is never lost or merged into the turn being
// published.
//
// A reentrant write is an `observe` observer with react write: each run
// writes its leaf a value no other operation writes (model.ts Reaction). Two
// checks, in a step whose operation is one turn (O2's list) and that is not
// same-tick with its neighbours:
// (a) never lost: the last reentrant write to each leaf in the step did not
//     throw, and the leaf holds its value once the step's turns are over;
// (b) not merged: another observer that does not read that leaf, ran once in
//     the step, reads something the operation itself touched (so that run is
//     the published turn's), and ran after the reentrant write, saw the leaf
//     without the reentrant value. Seeing it means the write landed inside
//     the turn still being published.
// "Attributed to the observer's writer context" is not checked: the published
// packages have no writer identity.
import type { Json, LeafPath, Op, StateView } from '../model.js';
import { formatReader } from '../model.js';
import { analyze, destroyedAt, readerReads, type Loc } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "**Reentrant writes.** A write made by an observer while a turn is being published is applied after that turn as its own turn, attributed to the observer's writer context. It is never lost or merged into the turn being published.";

const ONE_TURN = new Set<Op['kind']>(['write', 'transact', 'undo', 'redo', 'rollback', 'confirm', 'rowHeldWrite', 'linkPush']);

function leafOf(state: StateView | { readError: unknown }, path: LeafPath): Json | undefined {
  if ('readError' in state) return undefined;
  if (path === 'a') return state.a;
  const cfg = state.cfg as Record<string, Json> | null;
  return cfg && typeof cfg === 'object' ? cfg[path === 'cfg.p' ? 'p' : 'q'] : undefined;
}

export const O4 = instanceProperty({
  id: 'O4',
  row: ROW,
  clauses: { a: 'a reentrant write is never lost', b: 'a reentrant write is never merged into the turn being published' },
  reason: '"Attributed to the observer\'s writer context" is not checked: the published packages have no writer identity.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const { steps } = trace.sequence;
    const destroyed = destroyedAt(analysis) ?? Infinity;
    for (const s of analysis.steps) {
      if (s.index >= destroyed) break;
      const events = s.observation.observerEvents ?? [];
      const writes = events.flatMap((e, at) => (e.kind === 'write' ? [{ ...e, at }] : []));
      if (writes.length === 0) continue;
      if (steps[s.index]?.sameTick || steps[s.index - 1]?.sameTick || !ONE_TURN.has(s.op.kind)) continue;
      // (a) never lost.
      for (const path of new Set(writes.map((w) => w.path))) {
        const last = writes.filter((w) => w.path === path).pop();
        if (!last) continue;
        const held = s.after ? leafOf(s.after, path) : undefined;
        found.push(
          verdict(
            !last.error && held === last.value,
            s.index,
            last.error ? 'reentrant-write-refused' : 'reentrant-write-lost',
            { [path]: last.value },
            last.error ? { error: last.error.class, message: last.error.message } : { [path]: held ?? null },
            `observer ${last.observer} wrote ${path}=${last.value} while step ${s.index} was published`,
            'a'
          )
        );
      }
      // (b) not merged into the turn being published.
      const ownTouches: Loc[] = [...(s.touches?.sure ?? [])].filter((loc) => !writes.some((w) => w.path === loc));
      if (!s.touches) continue;
      const reentrantPaths = new Set<Loc>(writes.map((w) => w.path));
      for (const w of writes) {
        if (w.error) continue;
        for (const o of analysis.observers) {
          if (o.index === w.observer || o.step >= s.index) continue;
          if ([...reentrantPaths].some((loc) => readerReads(o.reader, loc))) continue;
          if (!ownTouches.some((loc) => readerReads(o.reader, loc))) continue;
          const runs = events.flatMap((e, at) => (e.kind === 'run' && e.observer === o.index ? [{ ...e, at }] : []));
          if (runs.length !== 1) continue;
          const run = runs[0];
          if (!run || run.at < w.at) continue;
          const seen = leafOf(run.saw, w.path);
          if (seen === undefined) continue;
          found.push(
            verdict(
              seen !== w.value,
              s.index,
              'reentrant-write-merged',
              { [w.path]: `not ${w.value}` },
              { [w.path]: seen },
              `observer ${o.index} on ${formatReader(o.reader)} ran for step ${s.index}'s turn ` +
                `after observer ${w.observer} wrote ${w.path}=${w.value}`,
                'b'
            )
          );
        }
      }
    }
    return found;
  },
});
