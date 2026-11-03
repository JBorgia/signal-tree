import { describe, expect, it } from 'vitest';
import { signalTree, transactions, external, entityMap } from '../index';
import { observeWrites } from '../internals';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('observer writes remain later than the transaction they observe', () => {
  it.each(['ordinary', 'external', 'transaction'] as const)(
    'preserves a later %s scalar write on explicit rollback',
    async (kind) => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      let armed = true;
      const off = observeWrites((frame) => {
        if (!armed || frame.path !== 'x' || frame.after !== 1) return;
        armed = false;
        if (kind === 'external') external(() => tree.$.x(2));
        else if (kind === 'transaction')
          tree.transact(() => tree.$.x(2)).confirm();
        else tree.$.x(2);
      });
      try {
        const pending = tree.transact(() => tree.$.x(1));
        await flush();
        expect(tree.$.x()).toBe(2);
        try {
          pending.rollback();
        } catch {
          /* Atomic refusal is valid v15 containment. */
        }
        expect(tree.$.x()).toBe(2);
      } finally {
        off();
        tree.destroy();
      }
    }
  );
  it('does not erase a later observer entity write when the callback throws', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }, string>() },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'a', value: 0 });
    await flush();
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || !frame.path.startsWith('rows')) return;
      armed = false;
      tree.$.rows.updateOne('a', { value: 2 });
    });
    try {
      expect(() =>
        tree.transact(() => {
          tree.$.rows.updateOne('a', { value: 1 });
          throw new Error('operation failed');
        })
      ).toThrow();
      await flush();
      expect(tree.$.rows.byId('a')?.value()).toBe(2);
    } finally {
      off();
      tree.destroy();
    }
  });
});
