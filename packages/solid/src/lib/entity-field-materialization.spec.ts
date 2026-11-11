import { createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';

describe('Solid fields first acquired after a state change', () => {
  it('retains native shape, identity and dependencies after late acquisition and rollback', () => {
    createRoot((dispose) => {
      const tree = signalTree({ rows: entityMap<{ id: string; value: number }, string>() }, { enhancers: [transactions()] });
      try {
        tree.$.rows.addOne({ id: 'a', value: 1 });
        const row = tree.$.rows.byIdOrFail('a');
        const descriptor = Object.getOwnPropertyDescriptor(row, 'value');
        const pending = tree.transaction(() => tree.$.rows.updateOne('a', { value: 2 }));
        const field = row.value;
        expect(typeof field).toBe('function');
        const observed = createMemo(() => field());
        expect(observed()).toBe(2);
        pending.rollback();
        expect(observed()).toBe(1);
        field.set(3);
        expect(observed()).toBe(3);
        expect(row.value).toBe(field);
        expect(Object.getOwnPropertyDescriptor(row, 'value')).toEqual(descriptor);
      } finally { dispose(); tree.destroy(); }
    });
  });

  it('binds a field first acquired while removed to the restored entity lifetime', () => {
    createRoot((dispose) => {
      const tree = signalTree({ rows: entityMap<{ id: string; value: number }, string>() }, { enhancers: [transactions()] });
      try {
        tree.$.rows.addOne({ id: 'a', value: 1 });
        const row = tree.$.rows.byIdOrFail('a');
        const pending = tree.transaction(() => tree.$.rows.removeOne('a'));
        const field = row.value;
        const observed = createMemo(() => field());
        expect(observed()).toBeUndefined();
        expect(() => field.set(7)).toThrow('not found');
        pending.rollback();
        expect(observed()).toBe(1);
        expect(tree.$.rows.byIdOrFail('a')).toBe(row);
        expect(row.value).toBe(field);
      } finally { dispose(); tree.destroy(); }
    });
  });
});
