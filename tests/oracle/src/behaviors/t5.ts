// T5 | Supersession vs dependency: newer truth is a later write by another
// writer context (for example origin 'server' or 'sync'). If it removed a row
// the transaction changed, that row is superseded and rollback reverses the
// rest of the turn; if it changed the row in any other way, it depends on the
// change and rollback refuses per T4
//
// "Newer truth" is read as a later write inside external() (truth from
// another authority); an ordinary write is not called truth by the row.
// (a) Every later write to the transaction's locations is newer truth that
//     removed a row: the rollback succeeds, every other location the
//     transaction changed returns to its value before the transaction, and
//     the removed rows stay removed. A transaction that rekeyed a row is left
//     to T6, which says where that row ends up; one that removed or replaced
//     a superseded row's key in its own body (clear, setAll, removeOne,
//     replaceOne, ...) is left alone, since whether the row it left is the
//     same entity is not fixed by the rows.
// (b) Newer truth updated a row the transaction changed: the rollback refuses
//     (T4 checks the cause).
import type { Json, WriteOp } from '../model.js';
import { analyze, isRowLoc, locValues, type Loc } from './analysis.js';
import { dependents, involvesRekey, rollbackContexts, rollbackOutcome, unclassified, type RollbackContext } from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';
import type { Analysis } from './analysis.js';

/** Whether a write may end one entity's life under `key` (so a row there afterwards may be another entity). */
function replacesKey(w: WriteOp, key: string): boolean {
  switch (w.kind) {
    case 'clear':
    case 'setAll':
      return true;
    case 'removeOne':
      return w.id === key;
    case 'removeMany':
      return (w.ids as readonly string[]).includes(key);
    case 'replaceOne':
      return w.id === key || w.row.id === key;
    case 'changeId':
      return w.from === key || w.to === key;
    default:
      return false;
  }
}

export const ROW =
  "Supersession vs dependency: newer truth is a later write by another writer context (for example origin 'server' or 'sync'). If it removed a row the transaction changed, that row is superseded and rollback reverses the rest of the turn; if it changed the row in any other way, it depends on the change and rollback refuses per T4";

/** Rows newer truth removed, when every later write is such a removal; undefined otherwise. */
export function supersededOnly(ctx: RollbackContext): Set<Loc> | undefined {
  if (ctx.pendingNewer.length > 0 || ctx.ambiguous.length > 0 || ctx.later.length === 0) return undefined;
  if (!ctx.later.every((w) => w.by === 'external' && w.depends.size === 0 && w.unclassified.size === 0)) return undefined;
  return new Set(ctx.later.flatMap((w) => [...w.removed]));
}

/**
 * The state the rows require after a rollback that completes the rest of the
 * turn: `rest` back to its value before the transaction, `gone` absent.
 */
export function completedRest(
  analysis: Analysis,
  ctx: RollbackContext,
  gone: ReadonlySet<Loc>
): { expected: Record<string, Json>; observed: Record<string, Json>; ok: boolean } | undefined {
  const opened = analysis.steps[ctx.tx.step];
  const after = analysis.steps[ctx.step]?.after;
  if (!opened?.before || !after) return undefined;
  const before = locValues(opened.before);
  const now = locValues(after);
  if (!before.rowsKnown || !now.rowsKnown) return undefined;
  const expected: Record<string, Json> = {};
  const observed: Record<string, Json> = {};
  let ok = true;
  const read = (v: string | undefined): Json => (v === undefined ? 'absent' : (JSON.parse(v) as Json));
  for (const loc of [...ctx.tx.changed, ...gone]) {
    const want = gone.has(loc) ? undefined : before.values.get(loc);
    const got = now.values.get(loc);
    expected[loc] = read(want);
    observed[loc] = read(got);
    if (want !== got) ok = false;
  }
  return { expected, observed, ok };
}

export const T5 = instanceProperty({
  id: 'T5',
  row: ROW,
  reason: '"Newer truth" is read as a write inside external(); removal or update by an ordinary write is left to T4 or unchecked.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      const observed = rollbackOutcome(ctx, analysis);
      const rekey = involvesRekey(analysis, ctx) ? '-rekey' : '';
      const superseded = supersededOnly(ctx);
      if (superseded) {
        if (superseded.size === 0 || ![...superseded].every(isRowLoc) || ctx.tx.body.some((w) => w.kind === 'changeId')) continue;
        if ([...superseded].some((loc) => ctx.tx.body.some((w) => replacesKey(w, loc.slice(5))))) continue;
        const rest = completedRest(analysis, ctx, superseded);
        if (!rest) continue;
        const ok = observed.status === 'ok' && rest.ok;
        found.push(
          verdict(
            ok,
            ctx.step,
            (observed.status === 'ok' ? 'rest-not-reversed' : 'superseded-rollback-refused') + rekey,
            { status: 'ok', state: rest.expected },
            { ...observed, state: rest.observed },
            `rollback(tx${ctx.tx.index}) after newer truth removed ${[...superseded].join(', ')}`
          )
        );
        continue;
      }
      if (ctx.pendingNewer.length > 0 || ctx.ambiguous.length > 0 || unclassified(ctx).length > 0) continue;
      const truthUpdates = dependents(ctx).filter((w) => w.by === 'external' && [...w.depends].some(isRowLoc));
      if (truthUpdates.length === 0) continue;
      found.push(
        verdict(
          observed.status === 'refused',
          ctx.step,
          `dependent-rollback-completed${rekey}`,
          { status: 'refused' },
          observed,
          `rollback(tx${ctx.tx.index}) after newer truth updated ${[
            ...new Set(truthUpdates.flatMap((w) => [...w.depends].filter(isRowLoc))),
          ].join(', ')}`
        )
      );
    }
    return found;
  },
});
