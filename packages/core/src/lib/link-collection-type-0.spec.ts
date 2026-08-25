import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { external } from './external';
import { signalTree } from './signal-tree';

/**
 * LINK-COLLECTION-TYPE-0 — the RUNTIME COMPANION.
 *
 * The type proof lives in `link-collection-type-0.typing.spec.ts`, which `tsc`
 * checks and vitest excludes. This file exists so that proof stays tied to real
 * semantics: the natural value the TYPE claims must be the value the RUNTIME
 * actually moves.
 *
 * ```text
 * outbound   collection state  -> rows.all()   -> endpoint.set(Row[])
 * inbound    endpoint emits Row[] -> rows.setAll(value)
 * ```
 *
 * ⚠️ Deliberately small. LINK-COLLECTION-0 is the full runtime battery —
 * echo suppression, reconciliation, rollback interaction, handle lifetime — and
 * duplicating it here would make two records that can drift. This asserts only
 * the natural-value identity the typing spec depends on.
 *
 * The accessor rule under test is the one the LINK harness uses:
 *
 * ```ts
 * typeof x.all === 'function' && typeof x.setAll === 'function'
 *   -> read = () => x.all()
 *      write = v => x.setAll(v)
 * ```
 *
 * so `Row[]` is what crosses the endpoint in both directions — never the
 * collection API object, never a Map or Record, and never an append.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

const makeTree = () =>
  signalTree({
    rows: entityMap<Row, string>({ selectId: (r: Row) => r.id }),
  }) as unknown as {
    $: {
      rows: {
        addOne(r: Row): void;
        all(): Row[];
        setAll(r: Row[]): void;
        ids(): string[];
      };
    };
  };

/** The natural-value accessors, exactly as the LINK harness derives them. */
const accessorsFor = <T>(x: unknown) => {
  const coll = x as { all?: () => T; setAll?: (v: T) => void };
  if (typeof coll.all === 'function' && typeof coll.setAll === 'function') {
    return { read: () => coll.all!(), write: (v: T) => coll.setAll!(v) };
  }
  throw new Error('not a collection node');
};

describe('LINK-COLLECTION-TYPE-0 runtime: the natural value is Row[]', () => {
  it('OUTBOUND — the endpoint receives exactly all()', async () => {
    const tree = makeTree();
    await flush();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    tree.$.rows.addOne({ id: 'b', n: 2 });
    await flush();

    const { read } = accessorsFor<Row[]>(tree.$.rows);
    const sent = read();

    // An ARRAY of rows — not the entity API object, not a keyed map.
    expect(Array.isArray(sent)).toBe(true);
    expect(sent).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
    expect(sent).toEqual(tree.$.rows.all());
  });

  it('INBOUND — an emitted Row[] REPLACES the collection', async () => {
    const tree = makeTree();
    await flush();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    tree.$.rows.addOne({ id: 'b', n: 2 });
    await flush();

    const { write } = accessorsFor<Row[]>(tree.$.rows);
    external(() => write([{ id: 'c', n: 3 }, { id: 'd', n: 4 }]));
    await flush();

    // ⚠️ REPLACEMENT, not append and not merge. `a` and `b` are gone.
    expect(tree.$.rows.ids()).toEqual(['c', 'd']);
    expect(tree.$.rows.all()).toEqual([
      { id: 'c', n: 3 },
      { id: 'd', n: 4 },
    ]);
  });

  it('an empty emission empties the collection', async () => {
    const tree = makeTree();
    await flush();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await flush();

    const { write } = accessorsFor<Row[]>(tree.$.rows);
    external(() => write([]));
    await flush();

    // The control for "replacement": an append rule would leave `a` in place.
    expect(tree.$.rows.all()).toEqual([]);
  });

  it('the collection node itself is NOT callable at runtime either', async () => {
    const tree = makeTree();
    await flush();

    // The typing spec pins `tree.$.rows()` as a compile error. This is the
    // runtime half of the same fact: node access shape != linked value shape.
    expect(typeof (tree.$.rows as unknown)).toBe('object');
    expect(() => (tree.$.rows as unknown as () => unknown)()).toThrow();
  });
});
