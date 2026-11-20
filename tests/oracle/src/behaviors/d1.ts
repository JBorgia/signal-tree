// D1 | **Disposal.** Destroying a tree, or the Angular injector or Vue effect
// scope that owns it, releases every cell, subscription, link and plugin
// state. Afterwards every read or write throws a typed error, and teardown
// errors reach `onTreeError`.
//
// After a `destroy` that returned, at every later step:
// (a) an operation that reads or writes the tree (a write, transaction,
//     awaiting scope, undo, redo, rollback, held-row read or write, row
//     lookup, observer subscription, hydration, which reads the snapshot)
//     throws a typed error, not a built-in one (X1's sense of typed);
// (b) the state read after the step throws a typed error;
// (c) no observer runs and no link delivers to its endpoint (subscriptions
//     and links are released).
// Not checked: the Angular and Vue owners (no framework in the vocabulary),
// and teardown errors, which no vocabulary observer, link or plugin raises.
import type { ErrorInfo, Json, Op } from '../model.js';
import { analyze, destroyedAt } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  '**Disposal.** Destroying a tree, or the Angular injector or Vue effect scope that owns it, releases every cell, subscription, link and plugin state. Afterwards every read or write throws a typed error, and teardown errors reach `onTreeError`.';

const BUILT_IN = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'AggregateError',
  'non-error',
]);

/** Operations that read or write the tree. */
const TOUCHES_TREE = new Set<Op['kind']>([
  'write',
  'transact',
  'scopeAwait',
  'undo',
  'redo',
  'rollback',
  'rowHold',
  'rowHeldRead',
  'rowHeldWrite',
  'observe',
  'observerOpen',
  'hydrate',
]);

const describe = (e: ErrorInfo): Json => ({ class: e.class, message: e.message });

export const D1 = instanceProperty({
  id: 'D1',
  row: ROW,
  afterDestroy: true,
  reason: 'Framework owners (Angular injector, Vue effect scope) and teardown errors are not in the vocabulary.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const destroyed = destroyedAt(analysis);
    if (destroyed === undefined) return found;
    for (const s of analysis.steps.slice(destroyed + 1)) {
      const { outcome, observation, op } = s;
      // (a) the operation.
      if (TOUCHES_TREE.has(op.kind) && (outcome.status === 'ok' || outcome.status === 'error')) {
        const typed = outcome.status === 'error' && !BUILT_IN.has(outcome.error.class);
        found.push(
          verdict(
            typed,
            s.index,
            outcome.status === 'ok' ? 'operation-ran-after-destroy' : 'untyped-error-after-destroy',
            { status: 'refused', typed: true },
            outcome.status === 'ok' ? { status: 'ok' } : { status: 'refused', ...(describe(outcome.error) as object) },
            `${op.kind} at step ${s.index}, after destroy() at step ${destroyed}`
          )
        );
      }
      // (b) the state read.
      const { state } = observation;
      const readTyped = 'readError' in state && !BUILT_IN.has(state.readError.class);
      found.push(
        verdict(
          readTyped,
          s.index,
          'readError' in state ? 'untyped-read-error-after-destroy' : 'read-after-destroy',
          { read: 'refused', typed: true },
          'readError' in state ? { read: 'refused', ...(describe(state.readError) as object) } : { read: 'ok' },
          `state read after step ${s.index}, after destroy() at step ${destroyed}`
        )
      );
      // (c) released subscriptions and links.
      const runs = (observation.observerEvents ?? []).filter((e) => e.kind === 'run').length + observation.observerThrows;
      const deliveries = observation.pushes.length;
      if (analysis.observers.length > 0 || analysis.links.length > 0 || runs > 0) {
        found.push(
          verdict(
            runs === 0 && deliveries === 0,
            s.index,
            runs > 0 ? 'observer-ran-after-destroy' : 'link-delivered-after-destroy',
            { observerRuns: 0, deliveries: 0 },
            { observerRuns: runs, deliveries },
            `subscriptions and links at step ${s.index}, after destroy() at step ${destroyed}`
          )
        );
      }
    }
    return found;
  },
});
