import { createEffect, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

type Row = { id: number; name: string; v: number };

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('@signal-tree/solid — semantic conformance', () => {
  it('reads and writes a scalar leaf through a Solid accessor', () => {
    const tree = signalTree({ count: 0, label: 'a' });
    expect(tree.$.count()).toBe(0);
    tree.$.count.set(5);
    expect(tree.$.count()).toBe(5);
    tree.$.label.set('b');
    expect(tree.$.label()).toBe('b');
    tree.destroy();
  });

  it('notifies a Solid effect when kernel state changes', async () => {
    const { tree, seen, dispose } = createRoot((dispose) => {
      const tree = signalTree({ count: 0 });
      const seen: number[] = [];
      createEffect(() => seen.push(tree.$.count()));
      return { tree, seen, dispose };
    });
    await nextTick();
    tree.$.count.set(1);
    await nextTick();
    tree.$.count.set(2);
    await nextTick();
    expect(seen).toEqual([0, 1, 2]);
    dispose();
    tree.destroy();
  });

  /**
   * Equality is the KERNEL's, not Solid's. The adapter creates its signals with
   * `equals: false` precisely so Solid cannot suppress a notification the
   * kernel decided to publish — the kernel already applied its own comparison
   * before publishing.
   */
  it('does not let Solid equality swallow a kernel publication', async () => {
    const { tree, seen, dispose } = createRoot((dispose) => {
      const tree = signalTree({ rows: entityMap<Row>({}) });
      tree.$.rows.setAll([{ id: 1, name: 'a', v: 1 }]);
      const node = tree.$.rows.byId(1);
      const seen: (string | undefined)[] = [];
      createEffect(() => seen.push(node?.()?.name));
      return { tree, seen, dispose };
    });
    await nextTick();
    tree.$.rows.updateOne(1, { name: 'b' });
    await nextTick();
    expect(seen).toEqual(['a', 'b']);
    dispose();
    tree.destroy();
  });

  it('keeps subject identity across remove and same-key re-add', () => {
    const tree = signalTree({ rows: entityMap<Row>({}) });
    tree.$.rows.setAll([{ id: 1, name: 'a', v: 1 }]);

    const stale = tree.$.rows.byId(1);
    expect(stale?.()).toEqual({ id: 1, name: 'a', v: 1 });

    tree.$.rows.removeOne(1);
    tree.$.rows.addOne({ id: 1, name: 'new-occupant', v: 9 });

    // Subject lifetime, not key identity: the held reference belongs to the
    // removed subject and must not follow the new occupant.
    expect(stale?.()).toBeUndefined();
    expect(tree.$.rows.byId(1)?.()).toEqual({
      id: 1,
      name: 'new-occupant',
      v: 9,
    });
    tree.destroy();
  });

  it('updates entity fields and whole entities', () => {
    const tree = signalTree({ rows: entityMap<Row>({}) });
    tree.$.rows.setAll([
      { id: 1, name: 'a', v: 1 },
      { id: 2, name: 'b', v: 2 },
    ]);
    tree.$.rows.updateOne(1, { v: 42 });
    expect(tree.$.rows.byId(1)?.()).toEqual({ id: 1, name: 'a', v: 42 });
    tree.$.rows.replaceOne(2, { id: 2, name: 'replaced', v: 7 });
    expect(tree.$.rows.byId(2)?.()?.name).toBe('replaced');
    tree.destroy();
  });

});

/**
 * `SOLID-ADAPTER-0`. The adapter supplies createEpoch and advanceEpoch as a
 * PAIR: Solid creates the handle and Solid advances it, so the kernel never
 * writes a framework-owned object.
 *
 * This is the guard the Vue failure earned. There, the kernel wrote the
 * adapter's cell directly — which worked on Angular by accident and left Vue's
 * entity invalidation permanently dead, because Vue ships `cell.set` as an
 * inert placeholder. Mutation-proved: making the advance inert must break
 * entity invalidation here too.
 */
describe('@signal-tree/solid — epoch advancement', () => {
  it('propagates entity invalidation through the Solid epoch', async () => {
    const { tree, seen, dispose } = createRoot((dispose) => {
      const tree = signalTree({ rows: entityMap<Row>({}) });
      tree.$.rows.setAll([{ id: 1, name: 'a', v: 1 }]);
      // Resolves through byId on every evaluation and never captures the node,
      // so the only path to invalidation is the epoch itself.
      const seen: (string | undefined)[] = [];
      createEffect(() => seen.push(tree.$.rows.byId(1)?.()?.name));
      return { tree, seen, dispose };
    });
    await nextTick();
    tree.$.rows.updateOne(1, { name: 'advanced' });
    await nextTick();
    expect(seen.at(-1)).toBe('advanced');
    dispose();
    tree.destroy();
  });

  it('publishes one coherent replacement for a whole-collection write', async () => {
    const { tree, pairs, dispose } = createRoot((dispose) => {
      const tree = signalTree({ rows: entityMap<Row>({}) });
      tree.$.rows.setAll([
        { id: 1, name: 'a', v: 1 },
        { id: 2, name: 'b', v: 2 },
      ]);
      const pairs: [number, number][] = [];
      createEffect(() =>
        pairs.push([
          tree.$.rows.byId(1)?.()?.v ?? -1,
          tree.$.rows.byId(2)?.()?.v ?? -1,
        ])
      );
      return { tree, pairs, dispose };
    });
    await nextTick();
    tree.$.rows.setAll([
      { id: 1, name: 'a', v: 10 },
      { id: 2, name: 'b', v: 20 },
    ]);
    await nextTick();
    // Both rows move together: no intermediate [10, 2] is observed.
    expect(pairs.at(-1)).toEqual([10, 20]);
    expect(pairs).not.toContainEqual([10, 2]);
    dispose();
    tree.destroy();
  });
});
