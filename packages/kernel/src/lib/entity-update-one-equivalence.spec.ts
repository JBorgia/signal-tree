import { describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';
import { withWriteContext } from './write-context';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: number; name: string; v: number };

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: 'n' + i, v: i }));

const collection = (enhancers: unknown[] = []) => {
  const tree = signalTree(
    { rows: entityMap<Row, number>({ selectId: (row) => row.id }) },
    enhancers.length
      ? ({ enhancers } as Parameters<typeof signalTree>[1])
      : undefined
  );
  tree.$.rows.setAll(rows(5));
  return tree;
};

/**
 * `UPDATEONE-FAST-0` — equivalence, not description.
 *
 * `updateOne` used to build an `EntityMutationFrame` for its single value
 * replacement: a mutation array, a prepared-instruction array from `.map`, a
 * `Set`, an id array and a generic commit switch, all to perform one
 * `retainSubjectValue`. Profiled under the real Angular adapter that framing
 * cost `entity-mutation-frame.commit` 20.3% of `updateOne` plus 9.4% GC.
 *
 * It now calls `commitExistingSubjectValue` directly. That is admissible only
 * because `updateOne` IS the admissible case by construction — one
 * `replace-value`, no create/restore/retire, no key, ordering, membership or
 * structural-owner change.
 *
 * EVERY assertion here passed against the frame implementation before the fast
 * path existed and must keep passing after. A test that only describes the new
 * behaviour would not have caught a divergence, so these were run against both.
 */
describe('updateOne is equivalent to the frame path', () => {
  it('replaces the value and leaves siblings alone', () => {
    const tree = collection();
    tree.$.rows.updateOne(2, { v: 99 });
    expect(tree.$.rows.byId(2)?.()).toEqual({ id: 2, name: 'n2', v: 99 });
    expect(tree.$.rows.byId(1)?.()).toEqual({ id: 1, name: 'n1', v: 1 });
    expect(tree.$.rows.ids().length).toBe(5);
    tree.destroy();
  });

  it('preserves held node identity across the update', () => {
    const tree = collection();
    const held = tree.$.rows.byId(3);
    expect(held).toBeDefined();
    tree.$.rows.updateOne(3, { v: 42 });
    // The same held reference must observe the new value — this is the
    // capability the subject/lifetime model exists to provide.
    expect(held?.()).toEqual({ id: 3, name: 'n3', v: 42 });
    expect(tree.$.rows.byId(3)).toBe(held);
    tree.destroy();
  });

  it('keeps the same subject lifetime, unlike remove and re-add', () => {
    const tree = collection();
    const held = tree.$.rows.byId(4);
    tree.$.rows.updateOne(4, { v: 7 });
    expect(held?.()).toBeDefined();

    // Contrast: a remove/re-add of the same key is a NEW subject, and the old
    // held reference must not follow it.
    tree.$.rows.removeOne(4);
    tree.$.rows.addOne({ id: 4, name: 'fresh', v: 0 });
    expect(held?.()).toBeUndefined();
    expect(tree.$.rows.byId(4)?.()).toEqual({ id: 4, name: 'fresh', v: 0 });
    tree.destroy();
  });

  it('invalidates the row and its fields', () => {
    const tree = collection();
    const node = tree.$.rows.byId(1);
    expect(node?.name()).toBe('n1');
    tree.$.rows.updateOne(1, { name: 'renamed' });
    expect(node?.name()).toBe('renamed');
    expect(tree.$.rows.byId(1)?.name()).toBe('renamed');
    tree.destroy();
  });

  it('refreshes whole-collection projections', () => {
    const tree = collection();
    expect(tree.$.rows.all().find((row) => row.id === 0)?.v).toBe(0);
    tree.$.rows.updateOne(0, { v: 123 });
    expect(tree.$.rows.all().find((row) => row.id === 0)?.v).toBe(123);
    expect(tree.$.rows.count()).toBe(5);
    tree.destroy();
  });

  it('a no-op patch leaves the value intact', () => {
    const tree = collection();
    const before = tree.$.rows.byId(2)?.();
    tree.$.rows.updateOne(2, {});
    expect(tree.$.rows.byId(2)?.()).toEqual(before);
    tree.destroy();
  });

  it('throws for an unknown id and changes nothing', () => {
    const tree = collection();
    expect(() => tree.$.rows.updateOne(999, { v: 1 })).toThrowError(
      /not found/
    );
    expect(tree.$.rows.ids().length).toBe(5);
    tree.destroy();
  });

  it('is undoable, and undo restores the prior value', async () => {
    const tree = collection([restoration()]);
    await flush();
    undoable(() => tree.$.rows.updateOne(1, { v: 500 }));
    await flush();
    expect(tree.$.rows.byId(1)?.().v).toBe(500);

    tree.undo();
    await flush();
    expect(tree.$.rows.byId(1)?.().v).toBe(1);
    tree.destroy();
  });

  it('keeps realized classification distinct from authored', async () => {
    const tree = collection([restoration()]);
    await flush();
    undoable(() => tree.$.rows.updateOne(1, { v: 10 }));
    await flush();

    withWriteContext({ intent: 'system', participation: 'realized' }, () =>
      tree.$.rows.updateOne(1, { v: 20 })
    );
    await flush();
    expect(tree.$.rows.byId(1)?.().v).toBe(20);

    // External truth now sits at that location, so reversing the authored turn
    // must refuse rather than overwrite it.
    expect(() => tree.undo()).toThrowError(/ST1034/);
    expect(tree.$.rows.byId(1)?.().v).toBe(20);
    tree.destroy();
  });

  it('participates in a transaction and rolls back', async () => {
    const tree = collection([restoration(), transactions()]);
    await flush();
    const pending = tree.transaction(() => tree.$.rows.updateOne(2, { v: 77 }));
    await flush();
    // Optimistic: the speculative value is visible before any decision.
    expect(tree.$.rows.byId(2)?.().v).toBe(77);

    pending.rollback();
    await flush();
    expect(tree.$.rows.byId(2)?.().v).toBe(2);
    tree.destroy();
  });

  it('a held node survives a transaction rollback', async () => {
    const tree = collection([restoration(), transactions()]);
    await flush();
    const held = tree.$.rows.byId(3);
    const pending = tree.transaction(() => tree.$.rows.updateOne(3, { v: 88 }));
    await flush();
    expect(held?.().v).toBe(88);

    pending.rollback();
    await flush();
    expect(held?.().v).toBe(3);
    expect(tree.$.rows.byId(3)).toBe(held);
    tree.destroy();
  });
});
