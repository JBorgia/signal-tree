import { afterEach, describe, expect, it } from 'vitest';
import type { WritableCell } from './internals/cell-runtime';

import { entityMap } from './types';
import { link, type Link } from './link';
import { signalTree } from './signal-tree';
import { withWriteContext } from './write-context';

/**
 * THE ROOT AS A LINK SOURCE.
 *
 * `link(tree.$, endpoint)` typechecks cast-free, so the root is supported. It
 * failed at runtime for two INDEPENDENT reasons, which is why supplying the
 * observation capabilities never fixed it:
 *
 *   bare            "X must be an owned SignalTree location"  — no owner carrier
 *   with capture    "x is not a function"                      — `tree.$` is a
 *                                                                plain object and
 *                                                                the read assumed
 *                                                                a callable
 *
 * `tree.$` is the ADDRESS; the whole-tree snapshot is the VALUE. The root is not
 * made callable, and no new observation mechanism exists for it — descendants
 * are observed through the adopted substrate exactly as for any branch.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;

const live: Link[] = [];
const track = (l: Link): Link => (live.push(l), l);
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
});

describe('link(tree.$) on an ordinary tree', () => {
  it('R3 publishes the COMPLETE whole-tree value', async () => {
    const tree = signalTree({ a: 1, b: { c: 2 } });
    await flush();
    const got: unknown[] = [];
    const l = track(link(tree.$, { set: (v: unknown) => void got.push(v) } as never));

    tree.$.a.set(3);
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ a: 3, b: { c: 2 } });

    tree.$.b.c.set(4);
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ a: 3, b: { c: 4 } });
  });

  it('R4 a descendant setter retained BEFORE the link still reaches it', async () => {
    const tree = signalTree({ a: 1, b: { c: 2 } });
    await flush();
    const leaf = tree.$.b.c as unknown as WritableCell<number>;
    const held = leaf.set.bind(leaf); // escapes before the link exists

    const got: unknown[] = [];
    const l = track(link(tree.$, { set: (v: unknown) => void got.push(v) } as never));
    held(9);
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ a: 1, b: { c: 9 } });
  });

  it('R5 OWNER ISOLATION — a same-shaped sibling tree is invisible', async () => {
    const a = signalTree({ a: 1, b: { c: 2 } });
    const b = signalTree({ a: 1, b: { c: 2 } });
    await flush();
    const got: unknown[] = [];
    const l = track(link(a.$, { set: (v: unknown) => void got.push(v) } as never));

    b.$.a.set(99); // identical path, different tree
    await flush();
    await l.settled();
    expect(got).toEqual([]);

    a.$.a.set(7);
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ a: 7, b: { c: 2 } });
  });

  it('⚠️ R6 inspection does not advance, and does not hitchhike', async () => {
    const tree = signalTree({ a: 1, b: { c: 2 } });
    await flush();
    const got: unknown[] = [];
    const l = track(link(tree.$, { set: (v: unknown) => void got.push(v) } as never));

    tree.$.a.set(10);
    await flush();
    await l.settled();
    const beforeInspection = got.length;

    withWriteContext(INSPECTION, () => tree.$.b.c.set(999));
    await flush();
    await l.settled();
    expect(got.length).toBe(beforeInspection);

    // A later unrelated authored write must not carry the scrub outward.
    tree.$.a.set(11);
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ a: 11, b: { c: 2 } });
    expect(tree.$.b.c()).toBe(999); // local state DID change
  });

  it('R7 a realized write IS eligible', async () => {
    const tree = signalTree({ a: 1, b: { c: 2 } });
    await flush();
    const got: unknown[] = [];
    const l = track(link(tree.$, { set: (v: unknown) => void got.push(v) } as never));
    withWriteContext(
      { intent: 'system', origin: 'external', participation: 'realized' },
      () => tree.$.b.c.set(5)
    );
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ a: 1, b: { c: 5 } });
  });

  it('R8 a COLLECTION inside the root publishes canonically', async () => {
    // The integration point with the repaired nested-collection projection.
    const tree = signalTree({
      title: 'x',
      rows: entityMap<{ id: number; n: string }, number>({ selectId: (e) => e.id }),
    });
    await flush();
    const got: unknown[] = [];
    const l = track(link(tree.$, { set: (v: unknown) => void got.push(v) } as never));

    tree.$.rows.addOne({ id: 1, n: 'a' });
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ title: 'x', rows: { all: [{ id: 1, n: 'a' }] } });

    tree.$.rows.updateOne(1, { n: 'b' });
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ title: 'x', rows: { all: [{ id: 1, n: 'b' }] } });

    tree.$.rows.removeOne(1);
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual({ title: 'x', rows: { all: [] } });
  });

  it('lifecycle — dispose ends the relationship', async () => {
    const tree = signalTree({ a: 1 });
    await flush();
    const got: unknown[] = [];
    const l = link(tree.$, { set: (v: unknown) => void got.push(v) } as never);
    tree.$.a.set(2);
    await flush();
    await l.settled();
    const at = got.length;
    l.dispose();
    tree.$.a.set(3);
    await flush();
    expect(got.length).toBe(at);
    expect(tree.$.a()).toBe(3);
  });
});
