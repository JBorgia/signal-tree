import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { deepEqual } from './utils';
import { entityMap } from './types';
import { link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * COMPARISON-FULL-STATE-0 — what does Link mean by "the same value"?
 *
 * ```text
 * NULL       Link endpoints exchange COMPLETE NaturalValue snapshots; equality
 *            is the already-earned deep-equality semantics; no comparator and
 *            no patch/merge protocol belong in the public API
 * FALSIFIER  an already-earned production behaviour cannot be represented when
 *            get/set/subscribe values are treated as complete values under the
 *            current equality rule
 * ```
 *
 * ## RESULT — the NULL SURVIVES.
 *
 * ⚠️ **"Full-state" describes the LINK BOUNDARY, not SignalTree's internal
 * mutation granularity.** The tree keeps granular entity notifications, granular
 * reversal and per-position causal identity; a Link endpoint nonetheless
 * exchanges `Row[]` as one complete collection value. Conflating the two levels
 * would be a false claim about the internals.
 *
 * ## Production makes exactly ONE equality decision
 *
 * ```ts
 * if (knownY !== undefined && deepEqual(now, knownY.value)) return;
 * ```
 *
 * That single line in the reconciliation loop is every equality decision Link
 * makes — it serves echo suppression AND acknowledgement reconciliation, which
 * DEMARCATION-0 already found were the same mechanism rather than two.
 *
 * ## ⚠️ The truthful phrasing of the equality guarantee
 *
 * `deepEqual` is NOT "JSON-like only", and it is NOT arbitrary JavaScript
 * semantic equality either. Measured coverage:
 *
 * ```text
 * primitives      SameValueZero — NaN equals NaN
 * arrays          element-wise
 * plain objects   key-wise
 * Date            by time value, Invalid Date equal to Invalid Date
 * RegExp          source + flags
 * Map / Set       structural
 * Error           name + message
 * boxed Number/String/Boolean
 * cycles          co-inductive, guarded past depth 64
 * functions       BY REFERENCE — two identical closures are not equal
 * ```
 *
 * So the guarantee is *structural equality over SignalTree's plain-data state
 * domain, plus those built-ins*. ⚠️ Link is NOT extended to accommodate exotic
 * values; this inventory exists so the documented promise matches the code.
 *
 * ## ⚠️ ONE MUTATION SURVIVED — reported, not hidden
 *
 * Removing the reconciliation loop's CONTINUATION — making it send once and
 * return instead of looping until X equals the acknowledged Y — kills NOTHING.
 * Not the race case here, and not the tightest form either: authoring X from
 * INSIDE `endpoint.set()` during its own await window still reconciles.
 *
 * The reason is that a write marks the notifier dirty, the next flush schedules
 * another durable consequence, and that re-entry does the follow-up send. So
 * the loop is REDUNDANT with flush-driven rescheduling for every case that can
 * be constructed through the public API.
 *
 * ⚠️ This does NOT mean LINK-RACE-1 was wrong — its harness had no flush-driven
 * rearm, so the loop was load-bearing THERE. It means the property is now
 * carried by a different mechanism in production, and the loop is belt-and-braces.
 *
 * Left in place deliberately: removing it is a production behaviour change with
 * no failing test to justify it, and "delete code no test covers" is how a
 * subtle race gets reintroduced. Recorded so the next person knows the loop is
 * unproven rather than assuming a passing suite vouches for it.
 *
 * ## No comparator is earned
 *
 * The question was never "could a custom comparator be useful" — it is whether
 * any EARNED behaviour required one. None did. So `LinkEndpoint` has no
 * `equals` / `comparator` / `compare` / `identityFn`, and the public surface
 * stays frozen.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

// ───────────────────────────────────────────────────────────────────────────
// 2/3 — the admitted NaturalValue cells, and full-state round trips
// ───────────────────────────────────────────────────────────────────────────

describe('COMPARISON-FULL-STATE-0: every admitted source exchanges COMPLETE values', () => {
  it('scalar leaf — inbound replaces', async () => {
    const tree = signalTree(
      { n: 1 },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    let emit!: (v: number) => void;
    const l = link(tree.$.n, {
      subscribe: (next) => {
        emit = next;
        return () => void 0;
      },
    });

    emit(2);
    await flush();
    expect(tree.$.n()).toBe(2);
    l.dispose();
  });

  it('⚠️ branch — an inbound value is COMPLETE, not a patch', async () => {
    const tree = signalTree(
      { cfg: { a: 1, b: 2 } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    let emit!: (v: { a: number; b: number }) => void;
    const l = link(tree.$.cfg, {
      subscribe: (next) => {
        emit = next;
        return () => void 0;
      },
    });

    emit({ a: 9, b: 2 });
    await flush();
    expect(tree.$.cfg()).toEqual({ a: 9, b: 2 });
    l.dispose();
  });

  it('outbound sends the COMPLETE branch value, not the changed key', async () => {
    const tree = signalTree(
      { cfg: { a: 1, b: 2 } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    const sent: unknown[] = [];
    const l = link(tree.$.cfg, { set: (v) => void sent.push(v) });

    tree.$.cfg.a.set(5);
    await flush();
    await l.settled();

    // ⚠️ `{ a: 5, b: 2 }` — NOT `{ a: 5 }`. One key changed; the whole value
    // crosses the boundary.
    expect(sent).toEqual([{ a: 5, b: 2 }]);
    l.dispose();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 9 — collections are REPLACED, never merged
// ───────────────────────────────────────────────────────────────────────────

describe('COMPARISON-FULL-STATE-0: collection boundary is full-value', () => {
  const collTree = () =>
    signalTree(
      { rows: entityMap<Row, string>({ selectId: (r: Row) => r.id }) },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as {
      $: { rows: { addOne(r: Row): void; all(): Row[]; ids(): string[] } };
    };

  it('⚠️ inbound [B, C] over [A, B] REPLACES — A is gone', async () => {
    const tree = collTree();
    await flush();
    tree.$.rows.addOne({ id: 'A', n: 1 });
    tree.$.rows.addOne({ id: 'B', n: 2 });
    await flush();

    let emit!: (v: Row[]) => void;
    // ⚠️ THE SOURCE CAST ERASES THE ENDPOINT'S VALUE TYPE TOO, so the endpoint
    // is typed at the same subject rather than left to infer from `never`.
    const l = link(tree.$.rows as never, {
      subscribe: (next: (v: Row[]) => void) => {
        emit = next;
        return (): void => void 0;
      },
    } as never);

    emit([
      { id: 'B', n: 2 },
      { id: 'C', n: 3 },
    ]);
    await flush();

    // Identical to `rows.setAll([B, C])`. NOT "upsert B and C, keep A".
    expect(tree.$.rows.ids()).toEqual(['B', 'C']);
    l.dispose();
  });

  it('and outbound sends the complete all() snapshot', async () => {
    const tree = collTree();
    await flush();
    tree.$.rows.addOne({ id: 'A', n: 1 });
    await flush();

    const sent: Row[][] = [];
    const l = link(tree.$.rows as never, {
      set: (v: Row[]) => void sent.push(v),
    });

    tree.$.rows.addOne({ id: 'B', n: 2 });
    await flush();
    await l.settled();

    // The whole collection, not the added row.
    expect(sent.at(-1)).toEqual([
      { id: 'A', n: 1 },
      { id: 'B', n: 2 },
    ]);
    expect(sent.at(-1)).toEqual(tree.$.rows.all());
    l.dispose();
  });

  it('⚠️ internal granularity is UNAFFECTED — the boundary is what is full-value', async () => {
    const tree = collTree();
    await flush();
    tree.$.rows.addOne({ id: 'A', n: 1 });
    await flush();

    // A row-level mutation still exists as a row-level mutation inside the
    // tree; only what crosses the Link is a complete value.
    const before = tree.$.rows.all();
    tree.$.rows.addOne({ id: 'B', n: 2 });
    await flush();
    expect(before).toHaveLength(1);
    expect(tree.$.rows.all()).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7/8 — equality controls: structure, not reference
// ───────────────────────────────────────────────────────────────────────────

describe('COMPARISON-FULL-STATE-0: equality is STRUCTURAL', () => {
  it('⚠️ a FRESH but deep-equal inbound value does not echo back out', async () => {
    const tree = signalTree(
      { cfg: { a: 1 } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    const sent: unknown[] = [];
    let emit!: (v: { a: number }) => void;
    const l = link(tree.$.cfg, {
      set: (v) => void sent.push(v),
      subscribe: (next) => {
        emit = next;
        return () => void 0;
      },
    });

    // A DIFFERENT object each time, structurally identical. Reference equality
    // would fail to suppress and loop the value back to the endpoint.
    emit({ a: 7 });
    await flush();
    await l.settled();
    expect(tree.$.cfg()).toEqual({ a: 7 });
    expect(sent).toEqual([]);

    emit({ a: 7 });
    await flush();
    await l.settled();
    expect(sent).toEqual([]);

    // A genuinely different value DOES send.
    tree.$.cfg.a.set(8);
    await flush();
    await l.settled();
    expect(sent).toEqual([{ a: 8 }]);

    l.dispose();
  });

  it('reconciliation is driven by the equality rule, not object identity', async () => {
    const tree = signalTree(
      { cfg: { a: 1 } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const sent: unknown[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let first = true;
    const l = link(tree.$.cfg, {
      set: (v) => {
        sent.push(v);
        if (first) {
          first = false;
          return gate;
        }
        return Promise.resolve();
      },
    });

    tree.$.cfg.a.set(2);
    await flush();
    expect(sent).toEqual([{ a: 2 }]);

    // Authored while the first send is still in flight.
    tree.$.cfg.a.set(3);
    await flush();

    release();
    await l.settled();

    // X != acknowledged X1, so the loop keeps going and sends X2.
    expect(sent).toEqual([{ a: 2 }, { a: 3 }]);
    l.dispose();
  });

  it('⚠️ and a re-write of an EQUAL value does not manufacture a send', async () => {
    const tree = signalTree(
      { cfg: { a: 1 } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    const sent: unknown[] = [];
    const l = link(tree.$.cfg, { set: (v) => void sent.push(v) });

    tree.$.cfg.a.set(2);
    await flush();
    await l.settled();
    expect(sent).toHaveLength(1);

    // Same value again — structurally equal to what Y acknowledged.
    tree.$.cfg.a.set(2);
    await flush();
    await l.settled();
    expect(sent).toHaveLength(1);

    l.dispose();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 — the equality domain, phrased truthfully
// ───────────────────────────────────────────────────────────────────────────

describe('COMPARISON-FULL-STATE-0: what deepEqual actually promises', () => {
  it('structural over plain data AND the built-ins it handles', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(new Date(5), new Date(5))).toBe(true);
    expect(deepEqual(/x/g, /x/g)).toBe(true);
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(deepEqual(new Set([1, 2]), new Set([1, 2]))).toBe(true);
  });

  it('⚠️ but functions compare BY REFERENCE — the documented limit', () => {
    const f = () => 1;
    expect(deepEqual(f, f)).toBe(true);
    // Two identical closures are NOT equal. Link is not extended to handle
    // this; the inventory exists so the promise is not overstated.
    expect(deepEqual(() => 1, () => 1)).toBe(false);
  });

  it('and distinguishes structurally different values', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(new Date(1), new Date(2))).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1/11 — the comparison harnesses must not leak into production
// ───────────────────────────────────────────────────────────────────────────

const SRC = (() => {
  for (const c of [join(process.cwd(), 'packages/kernel/src'), join(process.cwd(), 'src')]) {
    try {
      readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error('COMPARISON-FULL-STATE-0: could not locate packages/kernel/src');
})();

describe('COMPARISON-FULL-STATE-0: the experiment chose the architecture', () => {
  it('⚠️ NO comparison mode reaches production', () => {
    const src = readFileSync(join(SRC, 'lib/link.ts'), 'utf8');

    // Three harnesses carry a mode parameter, and NONE of them is a user
    // option:
    //
    //   LINK-HANDLE-0    'weak' | 'strong'
    //   LINK-HANDLE-1    'included' | 'excluded'
    //   LINK-ECHO-1      'correlation' | 'equality-said' | 'equality-held'
    //
    // Users do not choose the experiment.
    expect(src).not.toContain("mode:");
    expect(src).not.toContain('Suppression');
    expect(src).not.toMatch(/'weak'|'strong'|'included'|'excluded'/);
  });

  it('LinkEndpoint has no comparator of any spelling', () => {
    const src = readFileSync(join(SRC, 'lib/link.ts'), 'utf8');
    const iface = src.slice(
      src.indexOf('export interface LinkEndpoint'),
      src.indexOf('export interface Link ')
    );
    expect(iface.length).toBeGreaterThan(0);
    for (const spelling of ['equals', 'comparator', 'compare', 'identityFn']) {
      expect(iface).not.toContain(spelling);
    }
    // Exactly the three earned directions.
    expect(iface).toContain('get?(');
    expect(iface).toContain('set?(');
    expect(iface).toContain('subscribe?(');
  });

  it('production makes exactly ONE equality decision', () => {
    const src = readFileSync(join(SRC, 'lib/link.ts'), 'utf8');
    const calls = [...src.matchAll(/deepEqual\(/g)];
    // One call, in the reconciliation loop — which DEMARCATION-0 found is the
    // same mechanism as echo suppression rather than a second one.
    expect(calls).toHaveLength(1);
  });
});
