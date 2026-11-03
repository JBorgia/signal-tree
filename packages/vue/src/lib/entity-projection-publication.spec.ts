import { describe, expect, it } from 'vitest';
import { nextTick, watchEffect } from 'vue';

import {
  entityMap,
  signalTree,
  transactions,
  type PendingTransaction,
} from '../index';

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) {
    throw new Error('Missing required test value');
  }
  return value;
}

type Row = { id: string; v: number };
const build = () =>
  signalTree(
    { scalar: 0, rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions()] }
  );

describe('Vue entity projection publication', () => {
  it('review-empty: rollback observers see scalar, all, count, and empty restored', () => {
    const tree = build();
    let phase = 'setup';
    const seen: {
      phase: string;
      scalar: number;
      all: number[];
      count: number;
      empty: boolean;
    }[] = [];
    const dispose = watchEffect(
      () => {
        seen.push({
          phase,
          scalar: tree.$.scalar.value,
          all: tree.$.rows.all.value.map((row) => row.v),
          count: tree.$.rows.count.value,
          empty: tree.$.rows.empty.value,
        });
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.rows.addOne({ id: 'A', v: 1 });
      });
      phase = 'rollback';
      pending.rollback();
      const settlement = seen.filter((entry) => entry.phase === 'rollback');
      expect(settlement.length).toBeGreaterThan(0);
      expect(
        settlement.every(
          (entry) =>
            entry.scalar === 0 &&
            entry.all.length === 0 &&
            entry.count === 0 &&
            entry.empty === true
        ),
        JSON.stringify(seen)
      ).toBe(true);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('review-active: rollback observers see direct and active row restored', () => {
    const tree = build();
    tree.$.rows.addOne({ id: 'A', v: 0 });
    tree.$.rows.setActiveId('A');
    let phase = 'setup';
    const seen: {
      phase: string;
      scalar: number;
      row: number | undefined;
      all: number[];
      active: number | undefined;
    }[] = [];
    const dispose = watchEffect(
      () => {
        seen.push({
          phase,
          scalar: tree.$.scalar.value,
          row: tree.$.rows.byId('A')?.()?.v,
          all: tree.$.rows.all.value.map((row) => row.v),
          active: tree.$.rows.activeEntity.value?.v,
        });
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.rows.updateOne('A', { v: 1 });
      });
      phase = 'rollback';
      pending.rollback();
      const settlement = seen.filter((entry) => entry.phase === 'rollback');
      expect(settlement.length).toBeGreaterThan(0);
      expect(
        settlement.every(
          (entry) => entry.scalar === 0 && entry.row === 0 && entry.active === 0
        ),
        JSON.stringify(seen)
      ).toBe(true);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  for (const prime of [false, true]) {
    it.each(['add', 'remove', 'field', 'selection'] as const)(
      `coheres all owned reads for %s rollback (${
        prime ? 'primed' : 'unprimed'
      })`,
      async (operation) => {
        const tree = build();
        const rows = tree.$.rows;
        if (operation !== 'add') rows.addOne({ id: 'A', v: 0 });
        if (operation === 'selection') rows.addOne({ id: 'B', v: 8 });
        rows.setActiveId('A');
        const has = rows.has('A');
        const where = rows.where((row) => row.id === 'A');
        const find = rows.find((row) => row.id === 'A');
        const read = () => ({
          scalar: tree.$.scalar.value,
          ids: [...rows.ids.value],
          all: rows.all.value.map((row) => ({ ...row })),
          count: rows.count.value,
          asMap: [...rows.asMap.value.entries()].map(([key, row]) => [
            key,
            { ...row },
          ]),
          empty: rows.empty.value,
          activeId: rows.activeId.value,
          activeEntity: rows.activeEntity.value
            ? { ...rows.activeEntity.value }
            : undefined,
          has: has.value,
          where: where.value.map((row) => ({ ...row })),
          find: find.value ? { ...find.value } : undefined,
          byId: rows.byId('A')?.()?.v,
          field: rows.byId('A') ? rows.byIdOrFail('A').v.value : undefined,
        });
        if (prime) read();
        let phase = 'setup';
        const seen: ReturnType<typeof read>[] = [];
        const dispose = watchEffect(
          () => {
            void tree.$.scalar.value;
            if (prime || phase === 'rollback') {
              const value = read();
              if (phase === 'rollback') seen.push(value);
            }
          },
          { flush: 'sync' }
        );
        try {
          const pending = tree.transact(() => {
            tree.$.scalar.value = 1;
            if (operation === 'add') rows.addOne({ id: 'A', v: 1 });
            else if (operation === 'remove') rows.removeOne('A');
            else rows.updateOne('A', { v: 1 });
          });
          await nextTick();
          expect(tree.$.scalar.value).toBe(1);
          expect(rows.byId('A')?.()?.v).toBe(
            operation === 'remove' ? undefined : 1
          );
          // Selection is outside truth here. setActiveId has no transaction
          // capture notification; do not invent selection rollback semantics.
          if (operation === 'selection') rows.setActiveId('B');
          phase = 'rollback';
          pending.rollback();
          phase = 'after';
          await nextTick();
          // Derive the oracle from the authored setup, never from a possibly
          // stale final projection: matching stale observations are not proof.
          const restoredA = operation === 'add' ? undefined : { id: 'A', v: 0 };
          const restoredRows = restoredA ? [restoredA] : [];
          if (operation === 'selection') restoredRows.push({ id: 'B', v: 8 });
          const activeId = operation === 'selection' ? 'B' : 'A';
          const expected = {
            scalar: 0,
            ids: restoredRows.map((row) => row.id),
            all: restoredRows,
            count: restoredRows.length,
            asMap: restoredRows.map((row) => [row.id, row]),
            empty: restoredRows.length === 0,
            activeId,
            activeEntity: restoredRows.find((row) => row.id === activeId),
            has: restoredA !== undefined,
            where: restoredA ? [restoredA] : [],
            find: restoredA,
            byId: restoredA?.v,
            field: restoredA?.v,
          };
          expect(read()).toEqual(expected);
          expect(seen.length).toBeGreaterThan(0);
          for (const frame of seen) expect(frame).toEqual(expected);
        } finally {
          dispose();
          tree.destroy();
        }
      }
    );
  }

  it('preserves projection identities during unchanged-value settlement', async () => {
    const tree = build();
    const rows = tree.$.rows;
    rows.addOne({ id: 'A', v: 0 });
    rows.setActiveId('A');
    const where = rows.where((row) => row.id === 'A');
    const find = rows.find((row) => row.id === 'A');
    const read = () => [
      rows.ids.value,
      rows.all.value,
      rows.asMap.value,
      rows.activeEntity.value,
      where.value,
      find.value,
    ];
    const initial = read();
    let settling = false;
    const seen: ReturnType<typeof read>[] = [];
    const dispose = watchEffect(
      () => {
        void tree.$.scalar.value;
        const frame = read();
        if (settling) seen.push(frame);
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
      });
      await nextTick();
      settling = true;
      pending.rollback();
      expect(seen.length).toBeGreaterThan(0);
      for (const frame of seen)
        for (let index = 0; index < initial.length; index++)
          expect(frame[index]).toBe(initial[index]);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('retains cached projections inside reentrant authored writes and publishes their result', async () => {
    const tree = build();
    const rows = tree.$.rows;
    rows.addOne({ id: 'A', v: 0 });
    rows.setActiveId('A');
    const held = rows.all;
    let phase = 'setup';
    let entered = false;
    let nested: PendingTransaction | undefined;
    const inside: {
      before: readonly Row[];
      after: readonly Row[];
      direct: number | undefined;
    }[] = [];
    const dispose = watchEffect(
      () => {
        const scalar = tree.$.scalar.value;
        void held.value;
        if (phase !== 'rollback' || scalar !== 0 || entered) return;
        entered = true;
        const before = held.value;
        nested = tree.transact(() => {
          rows.updateOne('A', { v: 9 });
          inside.push({
            before,
            after: held.value,
            direct: rows.byId('A')?.()?.v,
          });
        });
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        rows.updateOne('A', { v: 1 });
      });
      await nextTick();
      phase = 'rollback';
      pending.rollback();
      phase = 'after';
      expect(entered).toBe(true);
      expect(inside).toHaveLength(1);
      expect(required(inside[0]).before).toEqual([{id:'A',v:0}]);
      expect(required(inside[0]).after).toEqual([{id:'A',v:9}]);
      expect(required(inside[0]).direct).toBe(9);
      expect(nested).toBeDefined();
      required(nested).confirm();
      await nextTick();
      expect(required(held.value[0]).v).toBe(9);
      expect(rows.activeEntity.value?.v).toBe(9);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('publishes marker-computed slices and sorted projection chains coherently', async () => {
    const tree = signalTree(
      {
        scalar: 0,
        rows: entityMap<Row, string>({
          selectId: (row) => row.id,
          sortComparer: (a, b) => a.v - b.v,
        }).computed('total', (all) => all.reduce((sum, row) => sum + row.v, 0)),
      },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addMany([
      { id: 'A', v: 0 },
      { id: 'B', v: 2 },
    ]);
    const where = tree.$.rows.where(() => true);
    const find = tree.$.rows.find(() => true);
    let phase = 'setup';
    const seen: {
      scalar: number;
      ids: string[];
      where: string[];
      find: string | undefined;
      total: number;
    }[] = [];
    const dispose = watchEffect(
      () => {
        const frame = {
          scalar: tree.$.scalar.value,
          ids: [...tree.$.rows.ids.value],
          where: where.value.map((row) => row.id),
          find: find.value?.id,
          total: tree.$.rows.total.value,
        };
        if (phase === 'rollback') seen.push(frame);
      },
      { flush: 'sync' }
    );
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.rows.updateOne('A', { v: 3 });
      });
      await nextTick();
      expect(tree.$.rows.ids.value).toEqual(['B', 'A']);
      expect(tree.$.rows.total.value).toBe(5);
      phase = 'rollback';
      pending.rollback();
      phase = 'after';
      expect(seen.length).toBeGreaterThan(0);
      for (const frame of seen)
        expect(frame).toEqual({
          scalar: 0,
          ids: ['A', 'B'],
          where: ['A', 'B'],
          find: 'A',
          total: 2,
        });
    } finally {
      dispose();
      tree.destroy();
    }
  });
});
