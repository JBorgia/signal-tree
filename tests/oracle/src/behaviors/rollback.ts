// What happened to a transaction's locations between the step that opened it
// and a rollback of it. T3–T7 each name a situation in these terms (a newer
// pending transaction on its locations, a later confirmed write that touched
// them, newer truth that removed a row or wrote another field of one, a
// rollback's compensation).
//
// Locations follow T4 (see Loc and Touches in analysis.ts): the transaction's
// locations are the ones it changed; a later step counts on them when its
// writes touched an overlapping location, whether or not it read the value,
// wrote the value already there (unless the seam skipped it), re-inserted a
// removed key, replaced the collection, ran in the rollback's own turn or
// came from a link (linkPush, linkRetrieve). A later write relates to the
// change, per location:
// - removed: a location in a row it removed (present before the write,
//   absent after). By newer truth that is supersession (T5); by anyone else
//   it is a touch like any other (T4).
// - depends: any other touched location.
// A later write that touched only other fields of a row the transaction
// changed is a side write: neither (T5), so a rollback keeps it.
//
// Skipped (the context is ambiguous), one reason each:
// - the transaction or a step after it whose state could not be read, or
//   whose writes do not reproduce the state it left: what it touched cannot
//   be seen;
// - an inbound link value that would leave the state as it was: whether it
//   landed cannot be seen;
// - a step touching a row the transaction rewrote without changing its key or
//   presence (replace, setAll keeping it): T4 counts touches of locations the
//   transaction "changed", and no row says whether such a rewrite changed one;
// - a link value that removed a row the transaction changed: no row says
//   whether a link is "another writer context", so T4 (dependency) and T5
//   (supersession) disagree;
// - a declaration's work on the transaction's locations: it may belong to the
//   pending owners it names, so no row says whether it is a confirmed write;
// - an undo or redo on the transaction's locations: it may be reversing the
//   transaction's own entry, which no row covers while it is pending;
// - a confirm, or a write that failed, that changed the transaction's
//   locations: which writes it made cannot be seen;
// - a rollback of an older transaction that changed them: reachable only
//   after that rollback ignored T3.
import {
  analyze,
  hasRow,
  isExistenceLoc,
  names,
  overlapping,
  overlapsAny,
  rowKeyOf,
  txStatus,
  type Analysis,
  type Loc,
  type TxInfo,
} from './analysis.js';
import type { SpecTrace } from '../trace.js';

export type WriteBy =
  /** an ordinary top-level write, or a write through a held row handle */
  | 'write'
  /** a write inside external(): truth from another authority */
  | 'external'
  /** an inbound link value (linkPush, linkRetrieve) */
  | 'link'
  /** a newer transaction, confirmed before the rollback */
  | 'confirmed-transaction';

/** A later write that touched some of the transaction's locations. */
export interface LaterWrite {
  readonly step: number;
  readonly by: WriteBy;
  /** The transaction's locations it touched. */
  readonly locs: ReadonlySet<Loc>;
  /** Of those, locations in rows it removed. */
  readonly removed: ReadonlySet<Loc>;
  /** Of those, the rest. */
  readonly depends: ReadonlySet<Loc>;
}

/** A later write that touched fields of rows the transaction changed, none of them overlapping a location it changed. */
export interface SideWrite {
  readonly step: number;
  readonly by: WriteBy;
  readonly locs: ReadonlySet<Loc>;
}

export interface RollbackContext {
  readonly step: number;
  readonly tx: TxInfo;
  /** Newer transactions, still pending, that touched this one's locations. */
  readonly pendingNewer: readonly TxInfo[];
  /** Newer transactions on this one's locations already rolled back. */
  readonly rolledBackNewer: readonly TxInfo[];
  readonly later: readonly LaterWrite[];
  readonly side: readonly SideWrite[];
  /** Steps where rolling back a newer transaction changed this one's locations. */
  readonly compensations: readonly number[];
  /** Why the rows do not fix the outcome, if they do not. */
  readonly ambiguous: readonly string[];
}

/** The context of the rollback at `step`, when it addresses a pending transaction. */
export function rollbackContext(analysis: Analysis, step: number): RollbackContext | undefined {
  const info = analysis.steps[step];
  if (!info || info.op.kind !== 'rollback' || info.tx === undefined) return undefined;
  const tx = analysis.txs[info.tx];
  if (!tx || txStatus(tx, step) !== 'pending') return undefined;
  const ctx = contextAt(analysis, tx, step);
  return info.unknown ? { ...ctx, ambiguous: [...ctx.ambiguous, "the rollback step's effect could not be read"] } : ctx;
}

const list = (locs: Iterable<Loc>) => [...locs].join(', ');

/** What happened to a pending transaction's locations from the step that opened it up to (not including) `step`. */
export function contextAt(analysis: Analysis, tx: TxInfo, step: number): RollbackContext {
  const pendingNewer: TxInfo[] = [];
  const rolledBackNewer: TxInfo[] = [];
  const later: LaterWrite[] = [];
  const side: SideWrite[] = [];
  const compensations: number[] = [];
  const ambiguous: string[] = [];
  if (tx.unknown) ambiguous.push('the transaction changed state that could not be read');
  if (!tx.touches) ambiguous.push("the transaction's writes do not reproduce the state it left");
  const changedRows = new Set([...tx.changed].map(rowKeyOf).filter((k): k is string => k !== undefined));
  const rewritten = new Set(
    [...(tx.touches?.sure ?? []), ...(tx.touches?.maybe ?? [])]
      .filter((loc) => isExistenceLoc(loc) && !tx.changed.has(loc))
      .map((loc) => rowKeyOf(loc) as string)
  );
  const outside = (loc: Loc) => !overlapsAny([loc], tx.changed);
  for (let j = tx.step + 1; j < step; j++) {
    const s = analysis.steps[j];
    if (!s) continue;
    if (s.unknown) {
      ambiguous.push(`step ${j}: state could not be read`);
      continue;
    }
    const t = s.touches;
    if (!t) {
      if (overlapsAny(s.changed, tx.changed) || [...tx.changed].some((loc) => names(s.op, s.outcome.status, loc))) {
        ambiguous.push(`step ${j}: its writes do not reproduce the state it left`);
      }
      continue;
    }
    const hit = overlapping(t.sure, tx.changed);
    const maybe = [...overlapping(t.maybe, tx.changed)].filter((loc) => !hit.has(loc));
    if (maybe.length > 0) {
      ambiguous.push(`step ${j}: may have touched ${list(maybe)}`);
      continue;
    }
    const rewrite = [...t.sure, ...t.maybe].filter((loc) => rewritten.has(rowKeyOf(loc) ?? '') && outside(loc));
    if (rewrite.length > 0) {
      ambiguous.push(`step ${j}: touched ${list(rewrite)}, in a row the transaction rewrote without changing its key or presence`);
      continue;
    }
    const sideLocs = new Set([...t.sure].filter((loc) => changedRows.has(rowKeyOf(loc) ?? '') && outside(loc)));
    if (hit.size === 0 && sideLocs.size === 0) continue;
    const write = (by: WriteBy) => {
      const removed = new Set<Loc>();
      const depends = new Set<Loc>();
      for (const loc of hit) {
        const key = rowKeyOf(loc);
        const gone = key !== undefined && hasRow(s.before, key) === true && hasRow(s.after, key) === false;
        (gone ? removed : depends).add(loc);
      }
      if (by === 'link' && removed.size > 0) {
        ambiguous.push(`step ${j}: a link value removed ${list(removed)}`);
        return;
      }
      if (hit.size > 0) later.push({ step: j, by, locs: hit, removed, depends });
      if (sideLocs.size > 0) side.push({ step: j, by, locs: sideLocs });
    };
    const { op, outcome } = s;
    if (op.kind === 'transact' && s.tx !== undefined) {
      const other = analysis.txs[s.tx] as TxInfo;
      const status = txStatus(other, step);
      if (status === 'confirmed') write('confirmed-transaction');
      else if (hit.size === 0) continue;
      else if (status === 'pending') pendingNewer.push(other);
      else rolledBackNewer.push(other);
    } else if (op.kind === 'rollback' && outcome.status === 'ok' && s.tx !== undefined) {
      if (hit.size === 0) continue;
      const other = analysis.txs[s.tx] as TxInfo;
      if (other.step > tx.step) compensations.push(j);
      else ambiguous.push(`step ${j}: rolling back an older transaction changed this one's locations`);
    } else if (op.kind === 'write' && outcome.status === 'ok') {
      write(op.wrap === 'external' ? 'external' : 'write');
    } else if (op.kind === 'rowHeldWrite' && outcome.status === 'ok') {
      write('write');
    } else if ((op.kind === 'linkPush' || op.kind === 'linkRetrieve') && outcome.status === 'ok') {
      write('link');
    } else if (hit.size > 0) {
      ambiguous.push(`step ${j}: ${op.kind} (${outcome.status}) touched ${list(hit)}`);
    }
  }
  return { step, tx, pendingNewer, rolledBackNewer, later, side, compensations, ambiguous };
}

/** Every rollback of a pending transaction in the trace, with its context. */
export function rollbackContexts(trace: SpecTrace): RollbackContext[] {
  const analysis = analyze(trace);
  const contexts: RollbackContext[] = [];
  for (const s of analysis.steps) {
    const ctx = rollbackContext(analysis, s.index);
    if (ctx) contexts.push(ctx);
  }
  return contexts;
}

/** Later writes T4 counts: every touching write except a removal by newer truth, which T5 calls supersession. */
export const dependents = (ctx: RollbackContext): LaterWrite[] =>
  ctx.later.filter((w) => w.depends.size > 0 || (w.removed.size > 0 && w.by !== 'external'));

/** Keys of rows newer truth removed, when every later write is such a removal; undefined otherwise. */
export function supersededOnly(ctx: RollbackContext): Set<string> | undefined {
  if (ctx.pendingNewer.length > 0 || ctx.ambiguous.length > 0 || ctx.later.length === 0) return undefined;
  if (!ctx.later.every((w) => w.by === 'external' && w.depends.size === 0)) return undefined;
  return new Set(ctx.later.flatMap((w) => [...w.removed].map((loc) => rowKeyOf(loc) as string)));
}

/** Locations newer truth wrote beside the transaction's own in rows it changed, outside rows in `gone`. */
export const truthSide = (ctx: RollbackContext, gone: ReadonlySet<string> = new Set()): Set<Loc> =>
  new Set(
    ctx.side.filter((w) => w.by === 'external').flatMap((w) => [...w.locs].filter((loc) => !gone.has(rowKeyOf(loc) ?? '')))
  );

export type RollbackObserved =
  | { readonly status: 'refused'; readonly cause: string | null; readonly class: string }
  | { readonly status: 'ok' | 'unsupported' | 'skipped' };

/** The rollback outcome in the terms the rows use. */
export function rollbackOutcome(ctx: RollbackContext, analysis: Analysis): RollbackObserved {
  const outcome = analysis.steps[ctx.step]?.outcome;
  if (!outcome) throw new Error(`no outcome at step ${ctx.step}`);
  if (outcome.status === 'error') {
    return { status: 'refused', cause: outcome.error.causeKind ?? null, class: outcome.error.class };
  }
  return { status: outcome.status };
}
