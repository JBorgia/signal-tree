// X3 | **Fault containment.** When an observer, link or plugin throws during
// any publication (including undo, redo and rollback), every other observer,
// link and plugin still runs, and state stays consistent. Errors are reported
// per T10 and are never thrown to the writer whose write was being published.
//
// A fault is an observer that throws (`observerOpen`, or `observe` with react
// throw) or a link whose endpoint throws (mode failing) delivering in the
// step. In a step with a fault:
// (a) the step's operation does not fail with the fault's error;
// (b) every other `observe` observer on the same reader as a throwing one
//     (same notification, so it was due to run too) still ran;
// (c) state stays consistent: a write or transaction that returned has all
//     its writes applied (they reproduce the state, analysis.ts Touches), and
//     every read path agrees (O3).
// "Reported per T10" is T10's property. Plugins that throw are not in the
// vocabulary, and links running on is not checked: whether a link may send
// at a given moment is L1's question.
import type { Op } from '../model.js';
import { canonical } from '../trace.js';
import { formatReader } from '../model.js';
import { analyze, destroyedAt, observerValidUntil } from './analysis.js';
import { pathDisagreements } from './o3.js';
import { runsIn } from './o1.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  '**Fault containment.** When an observer, link or plugin throws during any publication (including undo, redo and rollback), every other observer, link and plugin still runs, and state stays consistent. Errors are reported per T10 and are never thrown to the writer whose write was being published.';

/** Messages the vocabulary's faulty observers and endpoints throw (subjects/kernel.ts). */
const FAULTS = ['observer threw', 'endpoint refused the write'];
const PUBLISHERS = new Set<Op['kind']>([
  'write',
  'transact',
  'undo',
  'redo',
  'rollback',
  'confirm',
  'rowHeldWrite',
  'linkPush',
  'declare',
  'scopeAwait',
]);

export const X3 = instanceProperty({
  id: 'X3',
  row: ROW,
  clauses: {
    a: 'the fault is never thrown to the writer',
    b: 'every other observer still runs',
    c: 'state stays consistent',
  },
  reason: 'Plugins that throw are not in the vocabulary; links running on is left to L1; error reporting is T10.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const destroyed = destroyedAt(analysis) ?? Infinity;
    const valid = analysis.observers.map((o) => observerValidUntil(analysis, o));
    const failing = new Set(analysis.links.filter((l) => l.mode === 'failing').map((l) => l.index));
    for (const s of analysis.steps) {
      if (s.index >= destroyed) break;
      const { observation, outcome, op } = s;
      const linkFault = observation.pushes.some((p) => failing.has(p.link));
      if (observation.observerThrows === 0 && !linkFault) continue;
      const ran = outcome.status === 'ok' || outcome.status === 'error';
      if (!ran || !PUBLISHERS.has(op.kind)) continue;
      // (a) never thrown to the writer.
      const leaked = outcome.status === 'error' && FAULTS.some((f) => outcome.error.message.includes(f));
      found.push(
        verdict(
          !leaked,
          s.index,
          'fault-thrown-to-writer',
          { outcome: 'not the fault' },
          outcome.status === 'error' ? { error: outcome.error.class, message: outcome.error.message } : outcome.status,
          `${op.kind} at step ${s.index} published while ${linkFault ? 'a failing endpoint' : 'an observer'} threw`,
          'a'
        )
      );
      // (b) every other observer due to run still ran.
      const events = observation.observerEvents ?? [];
      const throwers = analysis.observers.filter(
        (o) => o.react.kind === 'throw' && events.some((e) => e.kind === 'run' && e.observer === o.index)
      );
      for (const t of throwers) {
        for (const o of analysis.observers) {
          if (o.index === t.index || o.step >= s.index || canonical(o.reader) !== canonical(t.reader)) continue;
          if (s.index >= (valid[o.index] ?? Infinity) || s.index >= (valid[t.index] ?? Infinity)) continue;
          const runs = runsIn([s], o.index);
          found.push(
            verdict(
              runs > 0,
              s.index,
              'other-observer-skipped',
              { observer: o.index, ran: true },
              { observer: o.index, ran: false },
              `observer ${o.index} on ${formatReader(o.reader)} while observer ${t.index} on the same reader threw at step ${s.index}`,
              'b'
            )
          );
        }
      }
      // (c) state stays consistent.
      if ((op.kind === 'write' || op.kind === 'transact') && outcome.status === 'ok' && !trace.sequence.steps[s.index - 1]?.sameTick) {
        found.push(
          verdict(
            s.touches !== undefined,
            s.index,
            'write-partly-applied',
            { applied: 'every write of the operation' },
            { applied: 'the state does not match the operation\'s writes' },
            `${op.kind} at step ${s.index} returned while a fault was raised`,
            'c'
          )
        );
      }
      const off = pathDisagreements(observation);
      if (off) {
        found.push(
          verdict(
            off.length === 0,
            s.index,
            'read-paths-disagree',
            { disagreements: [] },
            { disagreements: off },
            `read paths after the fault at step ${s.index}`,
            'c'
          )
        );
      }
    }
    return found;
  },
});
