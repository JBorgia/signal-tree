import { describe, expect, it, vi } from 'vitest';
import { signalTree } from './signal-tree';
import type { EntitySignal } from './types';
import { entityMap } from './markers/entity-map';
import { transactions } from '../enhancers/transactions/transactions';
import * as visits from './internals/visit-tree';
import { getPositionRegistry } from './internals/position-registry';

describe('point rollback owner resolution work', () => {
  it.each(['rows', 'rows.x', 'jo.doe@example.com'])('restores %s without inventorying unrelated topology', (key) => {
    const tree = signalTree({ x: 0, buckets: { [key]: entityMap<{ id: string; value: number }>() } }, { enhancers: [transactions()] });
    // The computed key above is explicitly seeded with this marker.
    const collection = tree.$.buckets[key] as EntitySignal<{ id: string; value: number }>;
    try {
      collection.addOne({ id: 'a.b', value: 0 });
      const pending = tree.transact(() => { tree.$.x(1); collection.byId('a.b')!.value(1); });
      const spy = vi.spyOn(visits, 'visitTree');
      try {
        pending.rollback();
        expect(tree.$.x()).toBe(0);
        expect(collection.byId('a.b')!.value()).toBe(0);
        expect(spy).not.toHaveBeenCalled();
      } finally { spy.mockRestore(); }
    } finally { tree.destroy(); }
  });
  it('falls back safely when structured addresses are unavailable', () => {
    const tree = signalTree({ x: 0, rows: entityMap<{id: string; value: number}>() }, {enhancers: [transactions()]});
    try {
      tree.$.rows.addOne({id: 'a.b', value: 0});
      const pending = tree.transact(() => {tree.$.x(1); tree.$.rows.byId('a.b')!.value(1);});
      const registry = getPositionRegistry(tree.$);
      expect(registry).toBeDefined();
      const spy = vi.spyOn(registry!, 'addressFor').mockReturnValue(undefined);
      try { pending.rollback(); } finally {spy.mockRestore();}
      expect(tree.$.x()).toBe(0);
      expect(tree.$.rows.byId('a.b')!.value()).toBe(0);
    } finally { tree.destroy(); }
  });
});
