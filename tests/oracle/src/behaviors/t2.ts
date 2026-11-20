// T2 | A rollback that cannot be proven safe refuses without changing
// anything and leaves the transaction pending; confirm() and a retried
// rollback() remain available
//
// Applies to every rollback of a pending transaction that refuses (throws).
// Expected: state, and every restoration counter readable both before and
// after, are as they were before the rollback (the counters only when the
// step before ended its turn: history entries are added when a turn ends); the next confirm() of that transaction succeeds, and the next
// rollback() of it either succeeds or refuses again naming its cause (a
// refusal names its cause, BRIEF.md 4.4).
import type { Json } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, outcomeSummary as summary, txStatus } from './analysis.js';

const isReadError = (v: Json | undefined) => typeof v === 'object' && v !== null && !Array.isArray(v) && 'readError' in v;
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'A rollback that cannot be proven safe refuses without changing anything and leaves the transaction pending; confirm() and a retried rollback() remain available';

export const T2 = instanceProperty({
  id: 'T2',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const previous = (step: number) => trace.records[step - 1]?.observation.restoration;
    // A counter whose read threw on either side says nothing about change.
    const readable = (a: Record<string, Json> | undefined, b: Record<string, Json> | undefined) => {
      const pick = (r: Record<string, Json> | undefined, keys: string[]) => Object.fromEntries(keys.map((k) => [k, r?.[k] ?? null]));
      const keys = Object.keys(a ?? {}).filter((k) => !isReadError(a?.[k]) && !isReadError(b?.[k]));
      return [pick(a, keys), pick(b, keys)] as const;
    };
    for (const s of analysis.steps) {
      if (s.op.kind !== 'rollback' || s.outcome.status !== 'error' || s.tx === undefined) continue;
      const tx = analysis.txs[s.tx];
      if (!tx || txStatus(tx, s.index) !== 'pending') continue;
      if (!s.unknown && s.before && s.after) {
        const turnEnded = trace.sequence.steps[s.index - 1]?.sameTick !== true;
        const [was, now] = turnEnded ? readable(previous(s.index), s.observation.restoration) : [{}, {}];
        const before = { state: s.before, restoration: was } as unknown as Json;
        const after = { state: s.after, restoration: now } as unknown as Json;
        const same = canonical(before) === canonical(after);
        found.push(
          verdict(
            same,
            s.index,
            'refusal-changed-state',
            before,
            after,
            same
              ? `the refused rollback at step ${s.index} changed nothing`
              : `the rollback at step ${s.index} refused but changed state or history`
          )
        );
      }
      const next = analysis.steps.find(
        (n) => n.index > s.index && n.tx === s.tx && (n.op.kind === 'confirm' || n.op.kind === 'rollback')
      );
      if (!next) continue;
      if (next.op.kind === 'confirm') {
        const ok = next.outcome.status === 'ok';
        found.push(
          verdict(
            ok,
            next.index,
            'confirm-unavailable',
            { confirm: 'ok' },
            { confirm: summary(next.outcome) },
            ok
              ? `confirm() after the refused rollback at step ${s.index} succeeded`
              : `confirm() after the refused rollback at step ${s.index} was not available`
          )
        );
      } else {
        const o = next.outcome;
        const ok = o.status === 'ok' || (o.status === 'error' && !!o.error.causeKind);
        found.push(
          verdict(
            ok,
            next.index,
            'retry-unavailable',
            { rollback: 'ok, or a refusal naming its cause' },
            { rollback: summary(o) },
            ok
              ? `the retried rollback at step ${next.index} was available`
              : `the retried rollback at step ${next.index} failed without naming a cause`
          )
        );
      }
    }
    return found;
  },
});

