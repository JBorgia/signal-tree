import { computed, effectScope, nextTick, watchEffect, type ComputedRef } from 'vue';
import { expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';

type Row = { id: string; v: number };

it('INTEGRATED-COLD-0: realizes Vue collection computation after cold writes and observes future writes', async () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const rows = tree.$.rows;
  const scope = effectScope();
  try {
    rows.setAll([{ id: 'a', v: 0 }]);
    rows.updateOne('a', { v: 1 });
    rows.updateOne('a', { v: 2 });
    const query = computed(() => rows.all.value.map(row => row.v).join(','));
    expect(query.value).toBe('2');
    expect(rows.count.value).toBe(1);
    const seen: string[] = [];
    scope.run(() => watchEffect(() => { seen.push(query.value); }, { flush: 'sync' }));
    expect(seen).toEqual(['2']);
    rows.updateOne('a', { v: 3 });
    await nextTick();
    expect(query.value).toBe('3');
    expect(seen).toEqual(['2', '3']);
    rows.addOne({ id: 'b', v: 4 });
    await nextTick();
    expect(query.value).toBe('3,4');
    expect(rows.count.value).toBe(2);
    expect(seen.at(-1)).toBe('3,4');
  } finally {
    scope.stop();
    tree.destroy();
  }
});

it('INTEGRATED-COLD-0: a Vue effect scope can acquire its first collection computation in a write tap', async () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const rows = tree.$.rows;
  rows.setAll([{ id: 'a', v: 0 }]);
  const scope = effectScope();
  const held: { query?: ComputedRef<number> } = {};
  const seen: number[] = [];
  const stop = rows.tap({ onUpdate() {
    if (!held.query) scope.run(() => {
      const query = computed(() => rows.all.value[0].v);
      held.query = query;
      watchEffect(() => { seen.push(query.value); }, { flush: 'sync' });
    });
  } });
  try {
    rows.updateOne('a', { v: 1 });
    await nextTick();
    const query = held.query;
    if (!query) throw new Error('Tap did not acquire its Vue collection computation');
    expect(query.value).toBe(1);
    expect(seen).toEqual([1]);
    rows.updateOne('a', { v: 2 });
    await nextTick();
    expect(query.value).toBe(2);
    expect(seen).toEqual([1, 2]);
    stop();
    rows.updateOne('a', { v: 3 });
    await nextTick();
    expect(query.value).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  } finally {
    stop();
    scope.stop();
    tree.destroy();
  }
});
