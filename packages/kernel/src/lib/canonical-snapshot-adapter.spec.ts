import { describe, expect, it } from 'vitest';

import {
  observeOwnerInvalidation,
  readCanonicalSnapshot,
} from '../adapter';
import { signalTree } from './signal-tree';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('canonical snapshot adapter handoff', () => {
  it('returns the canonical stable snapshot without calling the controller', () => {
    const tree = signalTree({ count: 1, nested: { value: 2 } });
    const first = readCanonicalSnapshot<{
      count: number;
      nested: { value: number };
    }>(tree);

    expect(readCanonicalSnapshot(tree)).toBe(first);
    tree.$.count.set(2);
    expect(readCanonicalSnapshot(tree)).toEqual({
      count: 2,
      nested: { value: 2 },
    });
    expect(readCanonicalSnapshot(tree)).not.toBe(first);
  });

  it('pairs invalidation with a canonical reread', async () => {
    const tree = signalTree({ count: 1 });
    const seen: unknown[] = [];
    const cleanup = observeOwnerInvalidation(tree, () => {
      seen.push(readCanonicalSnapshot(tree));
    });

    tree.$.count.set(2);
    await flush();

    expect(seen).toEqual([{ count: 2 }]);
    cleanup();
  });
});