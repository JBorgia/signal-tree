import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entityMap } from './types';
import { persistence } from '../enhancers/serialization/serialization';
import { signalTree } from './signal-tree';

/**
 * MARKER-LOCATION GRAMMAR AND PAYLOAD OPACITY.
 *
 * This file is the surviving carrier of an invariant that used to live in
 * `markers/stored-leak.spec.ts`. That file stated it as an absolute:
 *
 *     "a marker must NEVER carry its payload into a snapshot"
 *
 * MARKER-PAYLOAD-LEAK-0 measured that claim against the surviving marker family
 * and narrowed it. The absolute form was always broader than the API it
 * protected, because it conflated two different positions.
 *
 * THE GRAMMAR, measured rather than assumed:
 *
 *   position                    types      runtime    ST2021    payload in tree()
 *   ─────────────────────────── ────────── ────────── ───────── ─────────────────
 *   root object property        marker     marker     —         absent
 *   nested object property      marker     marker     —         absent
 *   class-instance property     marker     marker     —         absent
 *   array element               data       data       warns     PRESENT (is data)
 *   tuple element               data       data       warns     PRESENT (is data)
 *   Map value                   data       data       silent    PRESENT (is data)
 *   Set member                  data       data       silent    PRESENT (is data)
 *
 * Types and runtime AGREE on every row. An earlier reading of this table
 * claimed a class-instance disagreement; that was a measurement error — the
 * assertion was on the branch (`$.h`) rather than the marker position
 * (`$.h.rows`).
 *
 * "data" means the value is NOT interpreted as a marker declaration: it stays
 * the raw builder object for the life of the tree. `tree()` then contains it
 * because it contains every leaf value — that is `tree()` being correct, not a
 * leak. `ST2021` (`signal-tree.ts`) states the rule the grammar encodes:
 * **markers belong at object positions.**
 *
 * WHY THE NARROWED CLAIM IS STILL WORTH A TEST. `stored` made the absolute
 * version load-bearing because its supported options carried a live `Storage`
 * object — application data, reachable from the public API. The surviving
 * public marker cannot do that: `entityMap`'s entire public `EntityConfig` is
 * five optional FUNCTIONS (`selectId`, `sortComparer`, and three `hooks`), and
 * `loader()` — the only route to a `persist: { adapter }` storage object — is
 * not exported from any entry point. The `it` below measures that directly
 * rather than asserting it.
 *
 * So the permanent invariant is the narrower, true one:
 *
 *     at SUPPORTED marker positions, snapshots contain the MATERIALIZED VALUE
 *     and never the construction payload.
 *
 * One open item is CHARACTERIZED here, not fixed. It is a DIAGNOSTIC gap, not a
 * semantic one: Map values and Set members are treated as ordinary data, which
 * is the grammar behaving correctly. What differs is only that ST2021 scans
 * arrays, so the identical misuse warns in one container and is silent in the
 * other. Tracked as MARKER-GRAMMAR-DIAGNOSTICS-0.
 */

type Row = { id: number; name: string };
const cfg = () => ({
  selectId: (r: Row) => r.id,
  sortComparer: (a: Row, b: Row) => a.name.localeCompare(b.name),
});

/** Own keys of the builder. None of these is public state. */
const IMPL_KEYS = ['__isEntityMap', '__entityMapConfig', '__computedSlices'];

let warns: string[] = [];
beforeEach(() => {
  warns = [];
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => {
    warns.push(a.join(' '));
  });
});
const st2021 = () => warns.filter((w) => w.includes('ST2021')).length;

// ═══════════════════════════════════════════════════════════════════════════
// THE INVARIANT: supported positions are payload-opaque.
// ═══════════════════════════════════════════════════════════════════════════
describe('supported marker positions are payload-opaque', () => {
  function assertOpaque(label: string, json: string) {
    for (const k of IMPL_KEYS) {
      expect(json, `${label} must not expose ${k}`).not.toContain(k);
    }
  }

  it('tree() — root and nested object positions', () => {
    const tree = signalTree({
      rows: entityMap<Row, number>(cfg()),
      nested: { rows: entityMap<Row, number>(cfg()) },
    });
    tree.$.rows.setAll([{ id: 1, name: 'a' }]);

    const json = JSON.stringify(tree());
    assertOpaque('tree()', json);
    // CONTROL — the snapshot is not merely empty; it holds the real value.
    expect(JSON.parse(json)).toEqual({
      rows: { all: [{ id: 1, name: 'a' }] },
      nested: { rows: { all: [] } },
    });
  });

  it('persistence() — the durable path the stored leak actually reached', async () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    const tree = signalTree(
      { rows: entityMap<Row, number>(cfg()) },
      {
        enhancers: [
          persistence({ key: 'mlg', storage: storage as never, debounceMs: 0 }),
        ] as never,
      }
    );
    tree.$.rows.setAll([{ id: 1, name: 'a' }]);
    // autoSave lands as a post-commit durable consequence, never inline.
    await new Promise((r) => setTimeout(r, 20));

    const durable = [...map.values()].join('|');
    assertOpaque('persistence()', durable);
    // CONTROL — parsed, not substring-matched: persistence pretty-prints, so a
    // substring control silently mis-fires on an empty or reformatted payload.
    const parsed = JSON.parse(durable) as { data: { rows: { all: Row[] } } };
    expect(parsed.data.rows.all).toEqual([{ id: 1, name: 'a' }]);
  });

  it('the PUBLIC config has no field that can carry application data', () => {
    // Every public EntityConfig field, populated, with closures that CAPTURE a
    // secret — placed at the one position where the raw builder is visible.
    const secret = 'SECRET-JWT-captured';
    const marker = entityMap<Row, number>({
      selectId: (r) => r.id,
      sortComparer: (a, b) => a.name.localeCompare(b.name),
      hooks: {
        beforeAdd: (e) => (secret ? e : false),
        beforeUpdate: (_id, changes) => changes,
        beforeRemove: () => true,
      },
    });
    const json = JSON.stringify(signalTree({ list: [marker] })());

    expect(json).not.toContain(secret);
    // What survives is the empty husk of `hooks` — functions do not serialize.
    expect(JSON.parse(json)).toEqual({
      list: [{ __isEntityMap: true, __entityMapConfig: { hooks: {} }, __computedSlices: {} }],
    });
  });

  it('CONTROL — a data-bearing config WOULD be visible there', () => {
    // Forced, out-of-contract: the public API cannot produce this shape. It
    // proves the test above is measuring absence of data, not absence of a path.
    const m = entityMap<Row, number>(cfg()) as unknown as Record<string, unknown>;
    (m['__entityMapConfig'] as Record<string, unknown>)['probe'] = { t: 'SECRET-CTL' };
    expect(JSON.stringify(signalTree({ list: [m] } as never)())).toContain('SECRET-CTL');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE GRAMMAR: which positions interpret a marker declaration.
// ═══════════════════════════════════════════════════════════════════════════
describe('marker-location grammar', () => {
  const materialized = (v: unknown) =>
    typeof (v as { all?: unknown })?.all === 'function';

  it('object positions interpret the declaration; ST2021 stays quiet', () => {
    const tree = signalTree({
      rows: entityMap<Row, number>(cfg()),
      nested: { rows: entityMap<Row, number>(cfg()) },
    });
    expect(materialized(tree.$.rows)).toBe(true);
    expect(materialized(tree.$.nested.rows)).toBe(true);
    expect(st2021()).toBe(0);
  });

  it('array and tuple elements are ordinary data, and ST2021 says so', () => {
    const arr = signalTree({ a: [entityMap<Row, number>(cfg())] });
    expect(materialized(arr.$.a()[0])).toBe(false);
    expect(st2021()).toBe(1);

    warns = [];
    const tup: unknown[] = [entityMap<Row, number>(cfg())];
    signalTree({ b: tup });
    expect(st2021()).toBe(1);
  });

  it('⚠️ DIAGNOSTIC GAP — Map/Set are data (correct), but SILENTLY', () => {
    // The STATE outcome here is right: an out-of-contract position holds
    // ordinary data, exactly as the grammar says. Only the diagnostic differs —
    // ST2021 scans arrays, so identical misuse warns in one container and not
    // in the other. Left as-is deliberately: extending the scanner is a
    // behavior change, and the greenfield implementation should derive
    // diagnostics from the settled grammar rather than copy today's
    // array-specific scan. Tracked as MARKER-GRAMMAR-DIAGNOSTICS-0.
    signalTree({ m: new Map<string, unknown>([['a', entityMap<Row, number>(cfg())]]) });
    expect(st2021()).toBe(0);

    signalTree({ s: new Set<unknown>([entityMap<Row, number>(cfg())]) });
    expect(st2021()).toBe(0);
  });

  it('a class-instance property is an ordinary object position', () => {
    // Pinned because the first measurement read this as a type/runtime
    // disagreement. It is not: the type negative asserts the same conclusion.
    class Holder {
      rows = entityMap<Row, number>(cfg());
    }
    const tree = signalTree({ h: new Holder() });
    expect(materialized(tree.$.h.rows)).toBe(true);
    expect(JSON.stringify(tree())).not.toContain('__entityMapConfig');
  });
});
