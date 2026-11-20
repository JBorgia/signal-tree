// T9 | inspect() reports each change as 'current' or 'superseded'; confirm()
// and rollback() snapshot it; 'current' means the contribution stands, not
// that the value is unchanged
//
// Four checks on inspect() results (shape: InspectValue in model.ts):
// (a) every change's status is 'current' or 'superseded';
// (b) while the transaction is pending, every location it changed is
//     reported;
// (c) while it is pending, a reported change whose locations no later step
//     wrote, not even to the same value, is 'current' (its contribution
//     stands);
// (b) and (c) skip transactions that may change a row's key (changeId, or a
//     replace whose row has another id, analysis.ts changesKey): a rekey
//     spans two keys, so which key names the change, and whether a write to
//     the other key supersedes it, is not fixed by the row. They also skip a
//     transaction whose own change set cannot be told apart from other writes
//     in its step (analysis.ts TxInfo.unknown: an unreadable state, a scope
//     that awaited, an observer's reentrant write).
// (d) once confirm() or rollback() succeeded, every later inspect() returns
//     the same report (the snapshot).
// Locations are T4's (analysis.ts): a path names a leaf, a row field
// (`rows.<key>.<field>`) or a row's existence (`rows.<key>`), and a path
// covers or is written by any location overlapping it. A write to another
// field of a row does not write a reported field; one to the row's existence
// does.
import type { InspectValue, Json } from '../model.js';
import { canonical } from '../trace.js';
import {
  analyze,
  changesKey,
  isRowLoc,
  locsOfPath,
  mayWrite,
  overlaps,
  overlapsAny,
  txStatus,
  type Loc,
  type StepInfo,
} from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "inspect() reports each change as 'current' or 'superseded'; confirm() and rollback() snapshot it; 'current' means the contribution stands, not that the value is unchanged";

const STATUSES = new Set(['current', 'superseded']);

function changesOf(s: StepInfo): InspectValue['changes'] | undefined {
  if (s.outcome.status !== 'ok') return undefined;
  const value = s.outcome.value as Partial<InspectValue> | undefined;
  return Array.isArray(value?.changes) ? value.changes : undefined;
}

export const T9 = instanceProperty({
  id: 'T9',
  row: ROW,
  clauses: {
    a: "each status is 'current' or 'superseded'",
    b: 'while pending, every changed location is reported',
    c: "while pending, an untouched change is 'current'",
    d: 'after confirm() or rollback(), the report is a snapshot',
  },
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const settledReports = new Map<number, { step: number; report: string; changes: Json }>();
    for (const s of analysis.steps) {
      if (s.op.kind !== 'inspect' || s.tx === undefined) continue;
      const changes = changesOf(s);
      const tx = analysis.txs[s.tx];
      if (!changes || !tx) continue;
      const statuses = changes.map((c) => c.status);
      const valid = statuses.every((status) => STATUSES.has(status));
      found.push(
        verdict(
          valid,
          s.index,
          'unknown-status',
          { statuses: "each 'current' or 'superseded'" },
          { statuses },
          `inspect(tx${tx.index}) at step ${s.index}`,
          'a'
        )
      );
      const pending = txStatus(tx, s.index) === 'pending';
      const rekeys = tx.body.some(changesKey);
      if (pending && !tx.unknown && !rekeys) {
        const parsed = changes.map((c) => locsOfPath(c.path));
        const covered = (loc: Loc) => parsed.some((p) => p && (p.locs.some((l) => overlaps(l, loc)) || (p.allRows && isRowLoc(loc))));
        const missing = [...tx.changed].filter((loc) => !covered(loc));
        if (tx.changed.size > 0) {
          found.push(
            verdict(
              missing.length === 0,
              s.index,
              'change-not-reported',
              { reported: [...tx.changed] },
              { paths: changes.map((c) => c.path), missing },
              `inspect(tx${tx.index}) while pending reports each location it changed`,
              'b'
            )
          );
        }
      }
      if (pending && !rekeys && !tx.unknown) {
        const between = analysis.steps.slice(tx.step + 1, s.index);
        const untouched = (locs: readonly Loc[]) =>
          between.every((b) => !b.unknown && !overlapsAny(b.changed, locs) && locs.every((loc) => !mayWrite(b.op, loc)));
        for (const c of changes) {
          const parsed = locsOfPath(c.path);
          if (!parsed || parsed.allRows || parsed.locs.length === 0 || !untouched(parsed.locs)) continue;
          found.push(
            verdict(
              c.status === 'current',
              s.index,
              'standing-change-not-current',
              { path: c.path, status: 'current' },
              { path: c.path, status: c.status },
              `nothing wrote ${c.path} after tx${tx.index}, so its contribution stands`,
              'c'
            )
          );
        }
      } else if (!pending) {
        const report = canonical(changes);
        const first = settledReports.get(tx.index);
        if (!first) {
          settledReports.set(tx.index, { step: s.index, report, changes: changes as unknown as Json });
        } else {
          found.push(
            verdict(
              first.report === report,
              s.index,
              'snapshot-changed',
              first.changes,
              changes as unknown as Json,
              `inspect(tx${tx.index}) after settlement matches the report at step ${first.step}`,
              'd'
            )
          );
        }
      }
    }
    return found;
  },
});
