import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, batching } from '../index';

describe('angular dynamic entity batching', () => {
  it('uses native writes without escaping coalesce', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }>() },
      { enhancers: [batching()] }
    );
    try {
      tree.coalesce(() => {
        tree.$.rows.addOne({ id: 'a.b', value: 0 });
        const field = tree.$.rows.byIdOrFail('a.b').value;
        field.set(1);
        field.set(2);
        expect(field()).toBe(0);
      });
      const field = tree.$.rows.byIdOrFail('a.b').value;
      expect(field()).toBe(2);
    } finally {
      tree.destroy();
    }
  });
});
