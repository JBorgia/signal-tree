// T5 | Supersession vs dependency: newer truth is a later write by another
// writer context (for example origin 'server' or 'sync'). If it removed a row
// the transaction changed, that row is superseded and rollback reverses the
// rest of the turn; if it wrote a location the transaction changed (as defined
// in T4), it depends on the change and rollback refuses per T4. A write to
// another field of the same row is neither: rollback keeps it
//
// "Newer truth" is read as a later write inside external() (truth from
// another authority) or an inbound link value (another writer context,
// origin 'sync'); an ordinary write is not called truth by the row. An
// inbound link value replaces its whole source (a rows link runs setAll), so
// it never writes only another field of a row: (c) is reached by external()
// alone.
// Locations, touches and ambiguous contexts are rollback.ts's.
// (a) Every later write on the transaction's locations is newer truth that
//     removed their row (a removal touches existence, which every field of
//     the row depends on, so it supersedes the row's fields too): the
//     rollback succeeds, every other location the transaction changed
//     returns to its value before the transaction, the removed rows stay
//     removed, and fields newer truth wrote in the transaction's other rows
//     keep their values. A transaction that may change a row's key
//     (changeId, or a replace whose row has another id: analysis.ts
//     changesKey) is left to T6, which says where that row ends up; one
//     that removed, replaced or rekeyed a superseded row's key in its own
//     body (clear, setAll, removeOne, replaceOne, ...) is left alone, since
//     whether the row it left is the same entity is not fixed by the rows.
// (b) Newer truth touched a location the transaction changed without
//     removing its row: the rollback refuses (T4 checks the cause). A
//     transaction that replaced a row, or kept it through setAll, changed
//     the row's existence, so newer truth writing any of its fields is this
//     case, not (c).
// (c) Nothing later touched the transaction's locations, and newer truth
//     wrote other fields of rows it changed: the rollback succeeds, every
//     location the transaction changed returns to its value before it, and
//     each field newer truth wrote keeps the value it had just before the
//     rollback.
import type { Json, WriteOp } from '../model.js';
import { analyze, changesKey, existenceLoc, locValues, rowKeyOf, withRowFields, type Analysis, type Loc } from './analysis.js';
import {
  dependents,
  isNewerTruth,
  rollbackContexts,
  rollbackOutcome,
  supersededOnly,
  truthSide,
  type RollbackContext,
} from './rollback.js';
import { instanceProperty, verdict, type Instance } from './types.js';

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
  "Supersession vs dependency: newer truth is a later write by another writer context (for example origin 'server' or 'sync'). If it removed a row the transaction changed, that row is superseded and rollback reverses the rest of the turn; if it wrote a location the transaction changed (as defined in T4), it depends on the change and rollback refuses per T4. A write to another field of the same row is neither: rollback keeps it";

/** What a rollback that completes left, against what the rows require. */
export interface CompletedRest {
  readonly expected: Record<string, Json>;
  readonly observed: Record<string, Json>;
  /** Every location the transaction changed is back, and every row in `gone` is absent. */
  readonly restored: boolean;
  /** Every location in `kept` holds the value it had just before the rollback. */
  readonly kept: boolean;
}

/**
 * The state the rows require after a rollback that completes the rest of the
 * turn: the transaction's locations outside `gone` back to their values
 * before it (a row it removed comes back with its fields), the rows in `gone`
 * absent, and `kept` as it was just before the rollback.
 */
export function completedRest(
  analysis: Analysis,
  ctx: RollbackContext,
  gone: ReadonlySet<string>,
  kept: ReadonlySet<Loc>
): CompletedRest | undefined {
  const opened = analysis.steps[ctx.tx.step];
  const rollback = analysis.steps[ctx.step];
  if (!opened?.before || !rollback?.before || !rollback.after) return undefined;
  const before = locValues(opened.before);
  const prior = locValues(rollback.before);
  const now = locValues(rollback.after);
  if (!before.rowsKnown || !prior.rowsKnown || !now.rowsKnown) return undefined;
  const expected: Record<string, Json> = {};
  const observed: Record<string, Json> = {};
  const read = (v: string | undefined): Json => (v === undefined ? 'absent' : (JSON.parse(v) as Json));
  const check = (loc: Loc, want: string | undefined): boolean => {
    const got = now.values.get(loc);
    expected[loc] = read(want);
    observed[loc] = read(got);
    return want === got;
  };
  let restored = true;
  const back = [...ctx.tx.locs].filter((loc) => !gone.has(rowKeyOf(loc) ?? ''));
  for (const loc of withRowFields(back, before)) if (!check(loc, before.values.get(loc))) restored = false;
  for (const key of gone) if (!check(existenceLoc(key), undefined)) restored = false;
  let keptOk = true;
  for (const loc of kept) if (!check(loc, prior.values.get(loc))) keptOk = false;
  return { expected, observed, restored, kept: keptOk };
}

const completedKind = (observed: { status: string }, rest: CompletedRest, refused: string): string =>
  observed.status !== 'ok' ? refused : !rest.kept ? 'other-field-not-kept' : 'rest-not-reversed';

export const T5 = instanceProperty({
  id: 'T5',
  row: ROW,
  clauses: {
    a: 'newer truth removed the row: rollback reverses the rest of the turn',
    b: 'newer truth touched a location the transaction changed: rollback refuses',
    c: 'newer truth wrote another field of a row it changed: rollback keeps it',
  },
  reason:
    '"Newer truth" is read as a write inside external() or an inbound link value; removal or update by an ordinary write is left to T4.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const ctx of rollbackContexts(trace)) {
      const observed = rollbackOutcome(ctx, analysis);
      const superseded = supersededOnly(ctx);
      if (superseded) {
        if (superseded.size === 0 || ctx.tx.body.some(changesKey)) continue;
        if ([...superseded].some((key) => ctx.tx.body.some((w) => replacesKey(w, key)))) continue;
        const rest = completedRest(analysis, ctx, superseded, truthSide(ctx, superseded));
        if (!rest) continue;
        found.push(
          verdict(
            observed.status === 'ok' && rest.restored && rest.kept,
            ctx.step,
            completedKind(observed, rest, 'superseded-rollback-refused'),
            { status: 'ok', state: rest.expected },
            { ...observed, state: rest.observed },
            `rollback(tx${ctx.tx.index}) after newer truth removed ${[...superseded].map(existenceLoc).join(', ')}`,
            'a'
          )
        );
        continue;
      }
      if (ctx.pendingNewer.length > 0 || ctx.ambiguous.length > 0) continue;
      if (ctx.later.length === 0) {
        const kept = truthSide(ctx);
        if (kept.size === 0) continue;
        const rest = completedRest(analysis, ctx, new Set(), kept);
        if (!rest) continue;
        found.push(
          verdict(
            observed.status === 'ok' && rest.restored && rest.kept,
            ctx.step,
            completedKind(observed, rest, 'other-field-rollback-refused'),
            { status: 'ok', state: rest.expected },
            { ...observed, state: rest.observed },
            `rollback(tx${ctx.tx.index}) after newer truth wrote ${[...kept].join(', ')}, beside the fields it changed`,
            'c'
          )
        );
        continue;
      }
      const truth = dependents(ctx).filter((w) => isNewerTruth(w.by) && w.depends.size > 0);
      if (truth.length === 0) continue;
      found.push(
        verdict(
          observed.status === 'refused',
          ctx.step,
          'dependent-rollback-completed',
          { status: 'refused' },
          observed,
          `rollback(tx${ctx.tx.index}) after newer truth touched ${[...new Set(truth.flatMap((w) => [...w.depends]))].join(', ')}`,
          'b'
        )
      );
    }
    return found;
  },
});
