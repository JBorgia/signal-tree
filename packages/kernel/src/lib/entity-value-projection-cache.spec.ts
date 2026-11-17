import { describe, expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { StructuralStore } from './physical/structural-store';
import { prepareStructuralTarget } from './physical/prepare-structural-target';
import { getPathNotifier } from './path-notifier';

describe('demand-cached value projection subjects', () => {
  it('reuses unchanged subject order and isolates held arrays across mutation and clear', () => {
    const store = new StructuralStore<string>();
    store.createSubject(1, 'A');
    store.createSubject(2, 'B');
    store.createSubject(3, 'C');
    const before = store.activeSubjectsSnapshot();
    expect(before).toEqual([1, 2, 3]);
    expect(store.activeSubjectsSnapshot()).toBe(before);
    store.moveKeysToFront(['C', 'B']);
    expect(store.activeSubjectsSnapshot()).toEqual([3, 2, 1]);
    expect(before).toEqual([1, 2, 3]);
    store.transferSubject(2, 'B', 'X');
    expect(store.activeKeysSnapshot()).toEqual(['C', 'X', 'A']);
    expect(store.activeSubjectsSnapshot()).toEqual([3, 2, 1]);
    store.tombstoneSubject(2, 'X', true);
    expect(store.activeSubjectsSnapshot()).toEqual([3, 1]);
    store.restoreSubject(2, 'X', 3, 1);
    expect(store.activeSubjectsSnapshot()).toEqual([3, 2, 1]);
    store.placeActiveSubject(1, undefined, 3);
    expect(store.activeSubjectsSnapshot()).toEqual([1, 3, 2]);
    store.reorderActiveKeys(['X', 'A', 'C']);
    expect(store.activeSubjectsSnapshot()).toEqual([2, 1, 3]);
    store.clear();
    expect(store.activeSubjectsSnapshot()).toEqual([]);
    store.createSubject(7, 'A');
    expect(store.activeSubjectsSnapshot()).toEqual([7]);
    expect(before).toEqual([1, 2, 3]);
  });

  it('invalidates warmed subject order when installing a detached target', () => {
    const store = new StructuralStore<string>();
    store.createSubject(1, 'A');
    store.createSubject(2, 'B');
    store.createSubject(3, 'C');
    const before = store.activeSubjectsSnapshot();
    const beforeKeys = store.activeKeysSnapshot();
    const frontier = {};
    const target = store.prepareTarget(
      [
        { subjectId: 1, key: 'X' },
        { subjectId: 3, key: 'C' },
      ],
      [3, 1],
      frontier,
      prepareStructuralTarget
    );
    expect(store.activeSubjectsSnapshot()).toBe(before);
    expect(before).toEqual([1, 2, 3]);
    store.installPreparedTarget(target);
    expect(store.activeSubjectsSnapshot()).toEqual([3, 1]);
    expect(store.activeKeysSnapshot()).toEqual(['C', 'X']);
    expect(store.stateForSubject(2)?.active).toBe(false);
    expect(store.activeOrderFrontier()).toBe(frontier);
    expect(before).toEqual([1, 2, 3]);
    expect(beforeKeys).toEqual(['A', 'B', 'C']);
  });

  it('registers actual projected row objects with their exact subject identities', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; value: number }, number>(),
    });
    try {
      tree.$.rows.setAll([
        { id: 1, value: 1 },
        { id: 2, value: 2 },
      ]);
      const internal = tree.$.rows as typeof tree.$.rows & {
        __acquireEntityHandleForTesting(key: number): { subjectId: number };
      };
      const expected = new Map(
        [1, 2].map((id) => [
          id,
          internal.__acquireEntityHandleForTesting(id).subjectId,
        ])
      );
      tree.$.rows.updateOne(1, { value: 11 });
      // Observe actual WeakMap writes; no replacement implementation or relabelled counter.
      const spy = vi.spyOn(WeakMap.prototype, 'set');
      try {
        const projected = tree.$.rows.all();
        expect(projected).toEqual([
          { id: 1, value: 11 },
          { id: 2, value: 2 },
        ]);
        for (const row of projected)
          expect(
            spy.mock.calls.some(
              ([key, subject]) =>
                key === row && subject === expected.get(row.id)
            )
          ).toBe(true);
      } finally {
        spy.mockRestore();
      }
    } finally {
      tree.destroy();
    }
  });
});

type Receipt = { read(): Readonly<{ state: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(
    input:
      | { kind: 'independent' }
      | { kind: 'dependent'; owners: readonly object[] },
    work: () => unknown
  ): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
for (const claim of ['independent', 'dependent'] as const)
  it(`sort callback keeps pending native input: ${claim}`, async () => {
    const target = signalTree({ value: -1 });
    let armed = false,
      calls = 0;
    const source = signalTree(
      {
        rows: entityMap<{ id: number; n: number }, number>({
          sortComparer: (a, b) => {
            if (armed) {
              calls++;
              target.$.value(a.n + b.n);
            }
            return a.n - b.n;
          },
        }),
      },
      { enhancers: [transactions()] }
    );
    source.$.rows.setAll([
      { id: 1, n: 1 },
      { id: 2, n: 2 },
    ]);
    await flush();
    const sent: number[] = [];
    const connection = link(target.$.value, {
      set: (value) => {
        sent.push(value);
      },
    }) as Experimental;
    const pending = source.transact(() => source.$.rows.updateOne(1, { n: 5 }));
    try {
      const ownership = pending.inspect();
      let receipt: Receipt | undefined, error: unknown;
      try {
        receipt = connection.declare(
          claim === 'independent'
            ? { kind: claim }
            : { kind: claim, owners: [pending] },
          () => {
            armed = true;
            try {
              source.$.rows.all();
            } finally {
              armed = false;
            }
          }
        );
      } catch (caught) {
        error = caught;
      }
      expect(calls).toBeGreaterThan(0);
      expect(target.$.value()).toBe(7);
      expect(pending.inspect()).toEqual(ownership);
      if (claim === 'independent')
        expect(error).toMatchObject({
          stage: 'after-callback',
          reason: 'contradiction',
        });
      else expect(error).toBeUndefined();
      await flush();
      expect(sent).toEqual([]);
      pending.confirm();
      await flush();
      expect(sent).toEqual([7]);
      if (claim === 'dependent')
        expect(receipt?.read()).toMatchObject({
          state: 'started',
          basis: 'declared',
        });
      await connection.settled();
    } finally {
      connection.dispose();
      source.destroy();
      target.destroy();
    }
  });
