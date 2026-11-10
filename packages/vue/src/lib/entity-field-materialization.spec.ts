import { computed, isRef } from 'vue';
import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';

const drain = async () => { for (let pass = 0; pass < 120; pass++) await Promise.resolve(); };

describe('Vue fields first acquired after a state change', () => {
  it('retains native shape, identity and dependencies after late acquisition and rollback', async () => {
    const tree = signalTree({ rows: entityMap<{ id: string; value: number }, string>() }, { enhancers: [transactions()] });
    try {
      tree.$.rows.addOne({ id: 'a', value: 1 });
      const row = tree.$.rows.byIdOrFail('a');
      const descriptor = Object.getOwnPropertyDescriptor(row, 'value');
      const pending = tree.transact(() => tree.$.rows.updateOne('a', { value: 2 }));
      const field = row.value;
      expect(isRef(field)).toBe(true);
      const observed = computed(() => field.value);
      expect(observed.value).toBe(2);
      const sent: unknown[] = [];
      const connection = link(field, { set: (value) => { sent.push(value); } });
      try {
        await drain();
        expect(sent).toEqual([]);
        pending.rollback();
        await drain();
        expect(sent).toEqual([1]);
      } finally { connection.dispose(); }
      expect(observed.value).toBe(1);
      field.value = 3;
      expect(observed.value).toBe(3);
      expect(row.value).toBe(field);
      expect(Object.getOwnPropertyDescriptor(row, 'value')).toEqual(descriptor);
    } finally { tree.destroy(); }
  });

  it('binds a field first acquired while removed to the restored entity lifetime', () => {
    const tree = signalTree({ rows: entityMap<{ id: string; value: number }, string>() }, { enhancers: [transactions()] });
    try {
      tree.$.rows.addOne({ id: 'a', value: 1 });
      const row = tree.$.rows.byIdOrFail('a');
      const pending = tree.transact(() => tree.$.rows.removeOne('a'));
      const field = row.value;
      const observed = computed(() => field.value);
      expect(observed.value).toBeUndefined();
      expect(() => { field.value = 7; }).toThrow('not found');
      pending.rollback();
      expect(observed.value).toBe(1);
      expect(tree.$.rows.byIdOrFail('a')).toBe(row);
      expect(row.value).toBe(field);
    } finally { tree.destroy(); }
  });
});
