import { computed } from '@angular/core';

import { entityMap, signalTree } from '../index';

/**
 * SIGNALTREE REACTIVITY CONTRACT
 *
 * SignalTree's defensible claim over raw signals / SignalStore is *bounded
 * fan-out*: an update recomputes only the observers that actually depend on
 * what changed. This suite turns that claim into an enforced, regression-gated
 * invariant by measuring, for each reactive surface, how many observer bodies
 * re-run when one thing changes.
 *
 * Two contractual tiers:
 *   - BODY-GRANULAR: an UNRELATED update must NOT recompute the observer
 *     (fan-out 0 for the unrelated reader). This is the moat.
 *   - COLLECTION-LEVEL: a surface derived from a whole collection MUST
 *     recompute on any change to that collection (correct, not a leak) — we
 *     assert it so the boundary between the two tiers is explicit and locked.
 *
 * The counter lives inside the computed that establishes the dependency, so we
 * measure body recompute (wasted work), not the weaker downstream-propagation
 * isolation that computed-equality gives any signal for free.
 */
function track<T>(read: () => T) {
  let runs = 0;
  const c = computed(() => {
    runs++;
    return read();
  });
  return { runs: () => runs, read: () => c() };
}

type AnyRows = {
  addMany(rows: Array<Record<string, unknown>>): void;
  updateOne(id: number, changes: Record<string, unknown>): void;
  byId(id: number): { v(): number } | undefined;
  all(): unknown[];
  where(predicate: (row: { active: boolean }) => boolean): () => unknown[];
  active(): unknown[];
};

describe('SignalTree reactivity contract', () => {
  describe('memoization correctness', () => {
    it('skips recompute when unrelated tree leaves change', () => {
      const tree = signalTree(
        { a: 1, b: 2, unrelated: 0 },
        { capabilities: ['causal-runtime'] }
      );
      let computeCount = 0;
      const sum = computed(() => {
        computeCount += 1;
        return tree.$.a() + tree.$.b();
      });

      expect(sum()).toBe(3);
      expect(computeCount).toBe(1);

      tree.$.unrelated.set(99);
      expect(sum()).toBe(3);
      expect(computeCount).toBe(1);

      tree.$.a.set(10);
      expect(sum()).toBe(12);
      expect(computeCount).toBe(2);

      tree.destroy();
    });

    it('treats same-value writes as no-op', () => {
      const tree = signalTree({ x: 5 }, { capabilities: ['causal-runtime'] });
      let computeCount = 0;
      const doubled = computed(() => {
        computeCount += 1;
        return tree.$.x() * 2;
      });

      expect(doubled()).toBe(10);
      expect(computeCount).toBe(1);
      expect(doubled()).toBe(10);
      expect(computeCount).toBe(1);

      tree.$.x.set(5);
      expect(doubled()).toBe(10);
      expect(computeCount).toBe(1);

      tree.$.x.set(7);
      expect(doubled()).toBe(14);
      expect(computeCount).toBe(2);

      tree.destroy();
    });
  });

  it('keeps a materialized tree snapshot reactive inside a computed', () => {
    const tree = signalTree(
      { a: { x: 1 }, b: { y: 10 } },
      { capabilities: ['causal-runtime'] }
    );
    let runs = 0;
    const total = computed(() => {
      runs++;
      const snapshot = tree.$();
      return snapshot.a.x + snapshot.b.y;
    });

    expect(total()).toBe(11);
    expect(runs).toBe(1);

    tree.$.a.x.set(5);
    expect(total()).toBe(15);
    expect(runs).toBe(2);
  });

  it('observes correct snapshots when every computed result has fresh identity', () => {
    const tree = signalTree({ left: { value: 1 }, right: { value: 2 } });
    const snapshot = computed(() => structuredClone(tree.$()));

    const first = snapshot();
    expect(first).toEqual({ left: { value: 1 }, right: { value: 2 } });

    tree.$.left.value.set(3);
    const second = snapshot();

    expect(second).toEqual({ left: { value: 3 }, right: { value: 2 } });
    expect(second).not.toBe(first);
    expect(second.right).not.toBe(first.right);
  });

  describe('BODY-GRANULAR — an unrelated update must not recompute', () => {
    it('nested leaf: a sibling leaf update does not recompute the reader', () => {
      const tree = signalTree({ a: { v: 0 }, b: { v: 0 } });
      const t = track(() => tree.$.a.v());
      t.read();
      expect(t.runs()).toBe(1);
      tree.$.b.v.set(1); // unrelated sibling
      t.read();
      expect(t.runs()).toBe(1);
    });

    it('deep leaf: updating one deep path does not recompute a reader of another path', () => {
      const tree = signalTree({ x: { y: { z: 0 } }, p: { q: { r: 0 } } });
      const t = track(() => tree.$.x.y.z());
      t.read();
      tree.$.p.q.r.set(5); // unrelated deep path
      t.read();
      expect(t.runs()).toBe(1);
    });

    it('derived: recomputes only when its actual source changes', () => {
      const tree = signalTree(
        { a: 0, b: 0 },
        {
          derived: ($) => ({
            da: () => $.a() * 2,
          }),
        }
      );
      const t = track(() => (tree.$ as { da: () => number }).da());
      t.read();
      expect(t.runs()).toBe(1);
      tree.$.b.set(1); // not a source of `da`
      t.read();
      expect(t.runs()).toBe(1);
      tree.$.a.set(1); // actual source
      t.read();
      expect(t.runs()).toBe(2);
    });

    it('entityMap.byId: updating another entity does not recompute a per-entity reader', () => {
      const tree = signalTree({
        rows: entityMap<{ id: number; v: number }, number>(),
      });
      const rows = tree.$.rows as unknown as AnyRows;
      rows.addMany([
        { id: 1, v: 0 },
        { id: 2, v: 0 },
      ]);
      const t = track(() => rows.byId(1)?.v());
      t.read();
      expect(t.runs()).toBe(1);
      rows.updateOne(2, { v: 9 }); // different entity
      t.read();
      expect(t.runs()).toBe(1);
    });
  });

  describe('COLLECTION-LEVEL — must recompute on any collection change (correct)', () => {
    it('all() recomputes when any entity changes', () => {
      const tree = signalTree({
        rows: entityMap<{ id: number; v: number }, number>(),
      });
      const rows = tree.$.rows as unknown as AnyRows;
      rows.addMany([
        { id: 1, v: 0 },
        { id: 2, v: 0 },
      ]);
      const t = track(() => rows.all().length);
      t.read();
      rows.updateOne(2, { v: 9 });
      t.read();
      expect(t.runs()).toBe(2); // collection-derived
    });

    it('where() recomputes when any entity changes', () => {
      const tree = signalTree({
        rows: entityMap<{ id: number; active: boolean }, number>(),
      });
      const rows = tree.$.rows as unknown as AnyRows;
      rows.addMany([
        { id: 1, active: true },
        { id: 2, active: false },
      ]);
      const isActive = (r: { active: boolean }) => r.active;
      const t = track(() => rows.where(isActive)().length);
      t.read();
      rows.updateOne(2, { active: true });
      t.read();
      expect(t.runs()).toBe(2);
    });

    it('computed slice recomputes on any entity change', () => {
      const tree = signalTree({
        users: entityMap<{ id: number; active: boolean }, number>().computed(
          'active',
          (all) => all.filter((u) => u.active)
        ),
      });
      const users = tree.$.users as AnyRows;
      users.addMany([
        { id: 1, active: true },
        { id: 2, active: false },
      ]);
      const t = track(() => users.active().length);
      t.read();
      users.updateOne(2, { active: true });
      t.read();
      expect(t.runs()).toBe(2);
    });
  });
});
