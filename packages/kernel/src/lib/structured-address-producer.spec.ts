import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { entityMap } from './markers/entity-map';
import { acquireObservation } from './internals/observation-substrate';
import { getOwnedPositionIds } from './internals/owned-metadata';
import {
  createPositionRegistry,
  defineNodeAddress,
  getNodeAddress,
  getPositionRegistry,
} from './internals/position-registry';

describe('structured address producers', () => {
  it('snapshots construction keys without retaining mutable caller arrays', () => {
    const registry = createPositionRegistry();
    const node = {};
    const address = ['', 'a.b'];
    const position = registry.allocate();
    defineNodeAddress(node, address);
    registry.registerPositionAddress(position, address);
    address[0] = 'changed';
    expect(getNodeAddress(node)).toEqual(['', 'a.b']);
    expect(registry.addressFor(position)).toEqual(['', 'a.b']);
    expect(Object.isFrozen(registry.addressFor(position))).toBe(true);
  });

  it.each([false, true])(
    'registers leaves and collection proxies in one namespace, capture=%s',
    (capture) => {
      const tree = signalTree(
        {
          '': { 'a.b': 0 },
          'rows.x': entityMap<{ id: string | number; name: string }>(),
        },
        { enhancers: capture ? [transactions()] : [] }
      );
      const leaf = tree.$['']['a.b'];
      const registry = getPositionRegistry(tree.$)!;
      const previous = getOwnedPositionIds(leaf)?.[0];
      const off = acquireObservation(tree.$);
      try {
        const position = getOwnedPositionIds(leaf)![0];
        expect(getNodeAddress(tree.$)).toEqual([]);
        expect(getNodeAddress(tree.$[''])).toEqual(['']);
        expect(registry.addressFor(position)).toEqual(['', 'a.b']);
        if (previous !== undefined) expect(position).toBe(previous);
        const rows = tree.$['rows.x'];
        const owner = getOwnedPositionIds(rows)![0];
        expect(registry.addressFor(owner)).toEqual(['rows.x']);
        rows.addMany([
          { id: 1, name: 'number' },
          { id: '1', name: 'string' },
        ]);
        expect(rows.byId(1)!.name()).toBe('number');
        expect(rows.byId('1')!.name()).toBe('string');
        expect(registry.addressFor(owner)).toEqual(['rows.x']);
        expect(getPositionRegistry(rows)).toBe(registry);
        off();
        const again = acquireObservation(leaf);
        expect(getOwnedPositionIds(leaf)).toEqual([position]);
        again();
      } finally {
        off();
        tree.destroy();
      }
    }
  );
});
