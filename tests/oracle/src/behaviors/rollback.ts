// What happened to a transaction's locations between the step that opened it
// and a rollback of it. T3–T7 each name a situation in these terms (a newer
// overlapping transaction still open, a later confirmed write that depends on
// the change, newer truth that removed or updated a row, a rollback's
// compensation); a property applies only when the situation is unambiguous,
// so its expected outcome is the row's and nothing else.
//
// How a later write relates to the change, per location:
// - removed: a row it left absent. By newer truth that is supersession (T5).
// - depends: a row it updated (present before and after; T5 calls an update
//   by newer truth "depends"), or a leaf it read and rewrote (updateLeaf).
// - unclassified: a leaf it overwrote without reading it, or a row it
//   re-inserted. No row says whether that depends on the change.
// A transaction that wrote the whole collection (setAll, clear) is treated as
// covering every row: whether a later change to a row it left alone overlaps
// it is not fixed by the rows, so such a change makes the context ambiguous.
// So does a later write that names one of the transaction's locations but
// leaves its value as it was (rewriting the same value, or a setAll that
// keeps a removed row absent): no row says whether that depends on the change.
import type { Op, WriteOp } from '../model.js';
import {
  analyze,
  intersection,
  isRowLoc,
  rowAt,
  txStatus,
  writeTargets,
  type Analysis,
  type Loc,
  type TxInfo,
} from './analysis.js';
import type { SpecTrace } from '../trace.js';

/** A later write that changed some of the transaction's locations and still stands. */
export interface LaterWrite {
  readonly step: number;
  /**
   * write     an ordinary top-level write, or a write through a held row handle
   * external  a write inside external(): truth from another authority
   * confirmed-transaction  a newer transaction, confirmed before the rollback
   */
  readonly by: 'write' | 'external' | 'confirmed-transaction';
  /** The transaction's locations it changed. */
  readonly locs: ReadonlySet<Loc>;
  /** Of those, rows it left absent. */
  readonly removed: ReadonlySet<Loc>;
  /** Of those, rows it updated and leaves it read and rewrote: the write depends on the change. */
  readonly depends: ReadonlySet<Loc>;
  /** Of those, leaves it overwrote unread and rows it re-inserted. */
  readonly unclassified: ReadonlySet<Loc>;
}

/** Whether a step that ran names `loc` in one of its writes (writes, transactions, declarations). */
function names(op: Op, status: string, loc: Loc): boolean {
  if (status !== 'ok' && status !== 'error') return false;
  const writes: readonly WriteOp[] = op.kind === 'write' ? [op.write] : op.kind === 'transact' || op.kind === 'declare' ? op.body : [];
  return writes.some((w) => {
    const t = writeTargets(w);
    return t.locs.includes(loc) || (t.allRows && isRowLoc(loc));
  });
}

/** Whether `op` reads a leaf before writing it: its first write naming `loc` is updateLeaf. */
function readsFirst(op: Op, loc: Loc): boolean {
  const writes: readonly WriteOp[] = op.kind === 'write' ? [op.write] : op.kind === 'transact' ? op.body : [];
  const first = writes.find((w) => writeTargets(w).locs.includes(loc));
  return first?.kind === 'updateLeaf';
}

export interface RollbackContext {
  readonly step: number;
  readonly tx: TxInfo;
  /** Newer transactions, still pending, whose changes overlap this one's. */
  readonly pendingNewer: readonly TxInfo[];
  /** Newer overlapping transactions already rolled back. */
  readonly rolledBackNewer: readonly TxInfo[];
  readonly later: readonly LaterWrite[];
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

/** What happened to a pending transaction's locations from the step that opened it up to (not including) `step`. */
export function contextAt(analysis: Analysis, tx: TxInfo, step: number): RollbackContext {
  const pendingNewer: TxInfo[] = [];
  const rolledBackNewer: TxInfo[] = [];
  const later: LaterWrite[] = [];
  const compensations: number[] = [];
  const ambiguous: string[] = [];
  if (tx.unknown) ambiguous.push('the transaction changed state that could not be read');
  const wholeCollection = writesWholeCollection(tx);
  for (let j = tx.step + 1; j < step; j++) {
    const s = analysis.steps[j];
    if (!s) continue;
    if (s.unknown) {
      ambiguous.push(`step ${j}: state could not be read`);
      continue;
    }
    if (wholeCollection && [...s.changed].some((loc) => isRowLoc(loc) && !tx.changed.has(loc))) {
      ambiguous.push(`step ${j}: changed a row the transaction's whole-collection write covers`);
      continue;
    }
    const hit = intersection(s.changed, tx.changed);
    const unchangedNamed = [...tx.changed].filter((loc) => !hit.has(loc) && names(s.op, s.outcome.status, loc));
    if (unchangedNamed.length > 0) {
      ambiguous.push(`step ${j}: ${s.op.kind} rewrote ${unchangedNamed.join(', ')} without changing it`);
      continue;
    }
    if (hit.size === 0) continue;
    const removed = new Set<Loc>();
    const depends = new Set<Loc>();
    const unclassified = new Set<Loc>();
    for (const loc of hit) {
      if (isRowLoc(loc)) {
        const key = loc.slice(5);
        if (rowAt(s.after, key) === undefined) removed.add(loc);
        else if (rowAt(s.before, key) !== undefined) depends.add(loc);
        else unclassified.add(loc);
      } else if (readsFirst(s.op, loc)) {
        depends.add(loc);
      } else {
        unclassified.add(loc);
      }
    }
    const write = (by: LaterWrite['by']) => later.push({ step: j, by, locs: hit, removed, depends, unclassified });
    const { op, outcome } = s;
    if (op.kind === 'transact' && s.tx !== undefined) {
      const other = analysis.txs[s.tx] as TxInfo;
      const status = txStatus(other, step);
      if (status === 'pending') pendingNewer.push(other);
      else if (status === 'rolledBack') rolledBackNewer.push(other);
      else write('confirmed-transaction');
    } else if (op.kind === 'rollback' && outcome.status === 'ok' && s.tx !== undefined) {
      const other = analysis.txs[s.tx] as TxInfo;
      if (other.step > tx.step) compensations.push(j);
      else ambiguous.push(`step ${j}: rolling back an older transaction changed this one's locations`);
    } else if (op.kind === 'write' && outcome.status === 'ok') {
      write(op.wrap === 'external' ? 'external' : 'write');
    } else if (op.kind === 'rowHeldWrite' && outcome.status === 'ok') {
      write('write');
    } else {
      ambiguous.push(`step ${j}: ${op.kind} (${outcome.status}) changed ${[...hit].join(', ')}`);
    }
  }
  return { step, tx, pendingNewer, rolledBackNewer, later, compensations, ambiguous };
}

/**
 * Whether a rekey (changeId) is involved: in the transaction, or in a later
 * step or newer transaction that touched its locations. Violation kinds carry
 * a `-rekey` suffix then, because these properties read a rekey as changing
 * the row (location granularity is the row), which the rows do not spell out.
 */
export function involvesRekey(analysis: Analysis, ctx: RollbackContext): boolean {
  const rekeys = (op: Op) =>
    (op.kind === 'write' ? [op.write] : op.kind === 'transact' ? op.body : []).some((w) => w.kind === 'changeId');
  if (ctx.tx.body.some((w) => w.kind === 'changeId')) return true;
  const steps = [...ctx.later.map((w) => w.step), ...[...ctx.pendingNewer, ...ctx.rolledBackNewer].map((t) => t.step)];
  return steps.some((j) => {
    const s = analysis.steps[j];
    return s !== undefined && rekeys(s.op);
  });
}

/** Whether a transaction's body writes the whole collection. */
export const writesWholeCollection = (tx: TxInfo): boolean => tx.body.some((w) => w.kind === 'setAll' || w.kind === 'clear');

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

/** Later writes that depend on the change. */
export const dependents = (ctx: RollbackContext): LaterWrite[] => ctx.later.filter((w) => w.depends.size > 0);

/**
 * Later writes no row classifies: an unread overwrite, a re-insert, or a
 * removal by an ordinary write (T5 calls only removal by newer truth
 * supersession). A context containing one is left alone.
 */
export const unclassified = (ctx: RollbackContext): LaterWrite[] =>
  ctx.later.filter((w) => w.unclassified.size > 0 || (w.removed.size > 0 && w.by !== 'external'));

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
