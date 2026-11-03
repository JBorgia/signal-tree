import { describe, expect, it } from 'vitest';
import { nextTick, watchEffect } from 'vue';

import { transactionLifecycleReader } from '@signal-tree/kernel/internals';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { hasOpenCommitScope } from '../../../kernel/src/lib/internals/commit-consequence';
import { entityMap, signalTree, transactions } from '../index';

type Row = { id: string; v: number };
const marker = () => entityMap<Row, string>({ selectId: (row) => row.id });
const build = () =>
  signalTree({ scalar: 0, rows: marker() }, { enhancers: [transactions()] });
type Rows = ReturnType<typeof build>['$']['rows'];
const readRows = (rows: Rows) => {
  const activeId = rows.activeId.value;
  return {
    ids: [...rows.ids.value],
    all: rows.all.value.map((row) => ({ ...row })),
    count: rows.count.value,
    empty: rows.empty.value,
    map: [...rows.asMap.value].map(([key, row]) => [key, { ...row }]),
    activeId: activeId ?? null,
    active: rows.activeEntity.value?.v ?? null,
    directActive:
      activeId === undefined ? null : rows.byId(activeId)?.()?.v ?? null,
    directA: rows.byId('A')?.()?.v ?? null,
    directC: rows.byId('C')?.()?.v ?? null,
  };
};
const expectedRows = (values: Row[], selected: string) => ({
  ids: values.map((row) => row.id),
  all: values,
  count: values.length,
  empty: values.length === 0,
  map: values.map((row) => [row.id, row]),
  activeId: selected,
  active: values.find((row) => row.id === selected)?.v ?? null,
  directActive: values.find((row) => row.id === selected)?.v ?? null,
  directA: values.find((row) => row.id === 'A')?.v ?? null,
  directC: values.find((row) => row.id === 'C')?.v ?? null,
});
const attempt = (run: () => void) => {
  try {
    run();
    return { threw: false, error: undefined as unknown };
  } catch (error) {
    return { threw: true, error };
  }
};

describe('prepared selection publication', () => {
  it.each([
    'C',
    'C-then-X',
    'C-then-A',
    'nestedwrites',
    'callbackthrows',
    'callbackthrows-undefined',
    'removedselectedrows',
  ] as const)(
    'preserves callback contribution, complete disposition, and coherent delivery: %s',
    async (mode) => {
      const tree = build();
      const rows = tree.$.rows;
      rows.setAll([
        { id: 'A', v: 0 },
        { id: 'C', v: 0 },
      ]);
      rows.setActiveId('A');
      const heldA = rows.byIdOrFail('A');
      const lifecycle = transactionLifecycleReader(tree);
      if (!lifecycle) throw new Error('Expected transaction lifecycle reader');
      const failure =
        mode === 'callbackthrows-undefined'
          ? undefined
          : new Error('replay callback first failure');
      let phase = 'setup';
      let armed = false;
      let callbacks = 0;
      const read = () => ({ scalar: tree.$.scalar.value, ...readRows(rows) });
      const seen: { phase: string; value: ReturnType<typeof read> }[] = [];
      const dispose = watchEffect(
        () => {
          seen.push({ phase, value: read() });
        },
        { flush: 'sync' }
      );
      const untap = rows.tap({
        onRemove: (id) => {
          if (!armed || id !== 'D') return;
          callbacks++;
          rows.setActiveId('C');
          if (mode === 'C-then-X') rows.setActiveId('X');
          if (mode === 'C-then-A') rows.setActiveId('A');
          if (mode === 'nestedwrites') {
            tree.$.scalar.value = 9;
            rows.updateOne('C', { v: 9 });
          }
          if (mode === 'removedselectedrows') rows.removeOne('C');
          if (mode.startsWith('callbackthrows')) throw failure;
        },
      });
      try {
        const pending = tree.transact(() => {
          tree.$.scalar.value = 1;
          rows.changeId('A', 'X');
          rows.addOne({ id: 'D', v: 0 });
        });
        await nextTick();
        expect(tree.$.scalar.value).toBe(1);
        expect(rows.ids.value).toEqual(['X', 'C', 'D']);
        expect(rows.activeId.value).toBe('X');
        expect(lifecycle.snapshot().pending).toHaveLength(1);
        armed = true;
        phase = 'rollback';
        const first = attempt(() => pending.rollback());
        phase = 'after-rollback';
        await nextTick();
        const after = read();
        const countBeforeRetry = callbacks;
        phase = 'retry';
        const retry = attempt(() => pending.rollback());
        await nextTick();
        const values: Row[] = [{ id: 'A', v: 0 }];
        if (mode !== 'removedselectedrows')
          values.push({ id: 'C', v: mode === 'nestedwrites' ? 9 : 0 });
        const selected =
          mode === 'C-then-X' ? 'X' : mode === 'C-then-A' ? 'A' : 'C';
        const expected = {
          scalar: mode === 'nestedwrites' ? 9 : 0,
          ...expectedRows(values, selected),
        };
        expect(callbacks).toBe(1);
        expect(first.threw).toBe(mode.startsWith('callbackthrows'));
        if (mode.startsWith('callbackthrows'))
          expect(first.error).toBe(failure);
        expect(after).toEqual(expected);
        expect(lifecycle.snapshot().pending).toHaveLength(0);
        expect(hasOpenCommitScope(tree)).toBe(false);
        expect(retry.threw).toBe(false);
        expect(read()).toEqual(after);
        expect(callbacks).toBe(countBeforeRetry);
        expect(rows.byIdOrFail('A')).toBe(heldA);
        expect(heldA().v).toBe(0);
        const delivered = seen.filter(
          (frame) =>
            frame.phase === 'rollback' || frame.phase === 'after-rollback'
        );
        expect(delivered.length).toBeGreaterThan(0);
        for (const frame of delivered)
          expect(frame.value, JSON.stringify(seen)).toEqual(expected);
      } finally {
        dispose();
        untap();
        tree.destroy();
      }
    }
  );

  it('stages both collection publications before a cross-collection callback throws', async () => {
    const tree = signalTree(
      { scalar: 0, left: marker(), right: marker() },
      { enhancers: [transactions()] }
    );
    for (const rows of [tree.$.left, tree.$.right]) {
      rows.setAll([
        { id: 'A', v: 0 },
        { id: 'C', v: 0 },
      ]);
      rows.setActiveId('A');
    }
    const heldLeft = tree.$.left.byIdOrFail('A');
    const heldRight = tree.$.right.byIdOrFail('A');
    const lifecycle = transactionLifecycleReader(tree);
    if (!lifecycle) throw new Error('Expected transaction lifecycle reader');
    const failure = new Error('cross-collection replay failure');
    let armed = false;
    let callbacks = 0;
    let phase = 'setup';
    const read = () => ({
      scalar: tree.$.scalar.value,
      left: readRows(tree.$.left),
      right: readRows(tree.$.right),
    });
    const seen: { phase: string; value: ReturnType<typeof read> }[] = [];
    const dispose = watchEffect(
      () => {
        seen.push({ phase, value: read() });
      },
      { flush: 'sync' }
    );
    const untap = tree.$.left.tap({
      onRemove: (id) => {
        if (!armed || id !== 'D') return;
        callbacks++;
        tree.$.right.setActiveId('C');
        throw failure;
      },
    });
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.left.changeId('A', 'X');
        tree.$.right.changeId('A', 'X');
        tree.$.left.addOne({ id: 'D', v: 0 });
      });
      await nextTick();
      expect(tree.$.left.ids.value).toEqual(['X', 'C', 'D']);
      expect(tree.$.right.ids.value).toEqual(['X', 'C']);
      expect(lifecycle.snapshot().pending).toHaveLength(1);
      armed = true;
      phase = 'rollback';
      const first = attempt(() => pending.rollback());
      phase = 'after-rollback';
      await nextTick();
      const values = [
        { id: 'A', v: 0 },
        { id: 'C', v: 0 },
      ];
      const expected = {
        scalar: 0,
        left: expectedRows(values, 'A'),
        right: expectedRows(values, 'C'),
      };
      expect(callbacks).toBe(1);
      expect(first.threw).toBe(true);
      expect(first.error).toBe(failure);
      expect(read()).toEqual(expected);
      expect(lifecycle.snapshot().pending).toHaveLength(0);
      expect(hasOpenCommitScope(tree)).toBe(false);
      phase = 'retry';
      expect(attempt(() => pending.rollback()).threw).toBe(false);
      expect(read()).toEqual(expected);
      expect(callbacks).toBe(1);
      expect(tree.$.left.byIdOrFail('A')).toBe(heldLeft);
      expect(tree.$.right.byIdOrFail('A')).toBe(heldRight);
      const delivered = seen.filter(
        (frame) =>
          frame.phase === 'rollback' || frame.phase === 'after-rollback'
      );
      expect(delivered.length).toBeGreaterThan(0);
      for (const frame of delivered)
        expect(frame.value, JSON.stringify(seen)).toEqual(expected);
    } finally {
      dispose();
      untap();
      tree.destroy();
    }
  });
});
