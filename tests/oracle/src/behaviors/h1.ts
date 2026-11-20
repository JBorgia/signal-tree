// H1 | **Hydration.** State serialized on the server and hydrated on the
// client yields identical values. Hydration is one turn with origin
// `'server'`.
//
// A `hydrate` step serializes the tree through its snapshot read, writes the
// parsed snapshot whole into a fresh tree with the same plugins, and reports
// the fresh tree (model.ts HydrateValue). Three checks:
// (a) identical values: the fresh tree's a, cfg, rows in order and ids equal
//     the source tree's just before the step (ids included: after a rekey a
//     row's key differs from its `id` field, and the key is a value too);
// (b) one turn: each leaf observer on the fresh tree ran at most once;
// (c) each of those runs read the whole hydrated state.
// A hydration that throws fails (a). Origin 'server' is not checked: the
// published packages have no writer identity. Steps after destroy() are D1's.
import type { HydrateValue, Json, StateView } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, destroyedAt } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  "**Hydration.** State serialized on the server and hydrated on the client yields identical values. Hydration is one turn with origin `'server'`.";

const view = (s: StateView | { readError: unknown }): string | undefined =>
  'readError' in s ? undefined : canonical({ a: s.a, cfg: s.cfg, rows: s.rows, ids: s.ids });

export const H1 = instanceProperty({
  id: 'H1',
  row: ROW,
  reason: "Origin 'server' is not checked: the published packages have no writer identity. Hydration is read as a whole-value write of the parsed snapshot into a fresh tree.",
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const destroyed = destroyedAt(analysis) ?? Infinity;
    for (const s of analysis.steps) {
      if (s.op.kind !== 'hydrate' || s.index >= destroyed || !s.before) continue;
      const source = view(s.before);
      if (source === undefined) continue;
      const { outcome } = s;
      if (outcome.status === 'error') {
        found.push(
          verdict(
            false,
            s.index,
            'hydration-failed',
            { values: s.before as unknown as Json },
            { error: outcome.error.class, message: outcome.error.message },
            `hydrate() at step ${s.index}`
          )
        );
        continue;
      }
      if (outcome.status !== 'ok') continue;
      const value = outcome.value as unknown as HydrateValue | undefined;
      if (!value?.state) continue;
      const hydrated = view(value.state);
      found.push(
        verdict(
          hydrated === source,
          s.index,
          'hydrated-values-differ',
          { values: s.before as unknown as Json },
          { values: value.state as unknown as Json },
          `hydrate() at step ${s.index}`
        )
      );
      for (const o of value.observers) {
        found.push(
          verdict(
            o.saw.length <= 1,
            s.index,
            'hydration-in-several-turns',
            { runs: 'at most 1' },
            { runs: o.saw.length },
            `observer on ${o.path} of the hydrated tree`
          )
        );
        const partial = o.saw.map(view).filter((v) => v !== undefined && v !== hydrated);
        if (o.saw.length > 0) {
          found.push(
            verdict(
              partial.length === 0,
              s.index,
              'hydration-seen-partly',
              { saw: value.state as unknown as Json },
              { saw: partial.map((v) => JSON.parse(v as string) as Json) },
              `observer on ${o.path} of the hydrated tree`
            )
          );
        }
      }
    }
    return found;
  },
});
