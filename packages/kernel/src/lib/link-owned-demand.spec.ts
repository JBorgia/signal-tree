import { expect, it } from 'vitest';

import { link, signalTree } from '../index';
import { hasPathObservers } from './internals/path-observation-port';
import { getPositionRegistry } from './internals/position-registry';

it('a Link demands capture only for its owner and still delivers writes', async () => {
  const owner = signalTree({ n: 0 });
  const other = signalTree({ n: 0 });
  const sent: number[] = [];
  const connection = link(owner.$.n, {
    set: (value) => {
      sent.push(value);
    },
  });
  try {
    const ownerId = getPositionRegistry(owner.$.n)!.id;
    const otherId = getPositionRegistry(other.$.n)!.id;
    expect(ownerId).not.toBe(otherId);
    expect(hasPathObservers(ownerId)).toBe(true);
    expect(hasPathObservers(otherId)).toBe(false);
    owner.$.n(7);
    other.$.n(9);
    await connection.settled();
    expect(sent).toEqual([7]);
    expect(other.$.n()).toBe(9);
    expect(hasPathObservers(otherId)).toBe(false);
    connection.dispose();
    expect(hasPathObservers(ownerId)).toBe(false);
  } finally {
    connection.dispose();
    owner.destroy();
    other.destroy();
  }
});
