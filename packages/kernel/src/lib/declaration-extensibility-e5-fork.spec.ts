import { describe, expect, it } from 'vitest';
import { undoable } from './undoable';

import { signalTree } from './signal-tree';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';
import type { Location } from './internals/cell-runtime';

/**
 * M1+M2-E5 — THE EQUIVALENCE FORK.
 *
 * Asking only "are preserved signals second-class?" is too weak: a second-class
 * result does NOT rescue compiler extensibility. So both candidate paths are run
 * against the SAME kernel properties.
 *
 * The surviving path is ordinary canonical state with library API composed
 * around the tree's own universal location. Framework-native reactive objects
 * are adapter views, not alternate state declarations.
 *
 * Rule 0n: 14.x's marker protocol is historical evidence only. Nothing here
 * tests "do custom markers work".
 */

function makeCounterApi(accessor: Location<number>) {
  return {
    read: () => accessor(),
    increment: () => accessor(accessor() + 1),
    doubled: () => accessor() * 2,
  };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('E5 fork — canonical participation of the two candidate paths', () => {
  it('ordinary canonical state is captured by undo', async () => {
    const tree = signalTree({ counter: 10 }, { enhancers: [restoration()] });
    const api = makeCounterApi(tree.$.counter);

    // Designated: the question this test asks is whether ordinary canonical
    // state can PARTICIPATE in restoration, which requires an admitted turn.
    undoable(() => api.increment());
    await flush();
    expect(api.read()).toBe(11);

    tree.undo();
    await flush();

    expect(api.read()).toBe(10);
  });

  it('the library API composes derived values over canonical truth', () => {
    const tree = signalTree({ counter: 4 });
    const api = makeCounterApi(tree.$.counter);
    expect(api.doubled()).toBe(8);
    api.increment();
    expect(api.doubled()).toBe(10);
  });

  it('writes roll back through the generic transaction kernel', () => {
    const tree = signalTree({ counter: 10 }, { enhancers: [transactions()] });
    const api = makeCounterApi(tree.$.counter);

    const pending = tree.transaction(() => {
      api.increment();
      api.increment();
    });
    expect(api.read()).toBe(12);

    pending.rollback();
    expect(api.read()).toBe(10);
  });

  it('the value is ordinary canonical truth in the snapshot', () => {
    const tree = signalTree({ counter: 7, other: 'x' });
    const api = makeCounterApi(tree.$.counter);
    api.increment();
    expect(tree.$()).toEqual({ counter: 8, other: 'x' });
  });
});
