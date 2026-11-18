import { describe, expect, it } from 'vitest';

import type { Enhancer } from './types';
import { getTreeCapabilities } from './internals/tree-capabilities';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { link } from './link';
import { signalTree } from './signal-tree';

describe('empty construction plan boundaries', () => {
  it('does not adopt declarations appended while reading the initial state', () => {
    const declarations: Enhancer<unknown>[] = [];
    let applied = 0;
    const tree = signalTree(
      {
        get count() {
          declarations.push((owner) => {
            applied++;
            return owner;
          });
          return 0;
        },
      },
      { enhancers: declarations }
    );
    try {
      expect(declarations.length).toBeGreaterThan(0);
      expect(applied).toBe(0);
      tree.$.count(1);
      expect(tree.$.count()).toBe(1);
      expect(getTreeCapabilities(tree)).toEqual([]);
    } finally {
      tree.destroy();
    }
  });

  it('keeps an explicit substrate request distinct from an empty plan', async () => {
    const plain = signalTree({ count: 0 });
    const configured = signalTree(
      { count: 0 },
      { capabilities: ['causal-runtime'] }
    );
    const held = plain.$.count;
    const sent: number[] = [];
    try {
      expect(getTreeCapabilities(plain)).toEqual([]);
      expect(getTreeCapabilities(configured)).toContain('causal-runtime');
      expect(getOwnedPositionIds(held)).toBeUndefined();
      expect(getOwnedPositionIds(configured.$.count)?.length).toBe(1);
      held(1);
      const relationship = link(held, {
        set: (value) => void sent.push(value),
      });
      held(2);
      await relationship.settled();
      expect(sent).toEqual([2]);
      expect(getTreeCapabilities(plain)).toEqual([]);
      relationship.dispose();
      held(3);
      expect(held()).toBe(3);
    } finally {
      plain.destroy();
      configured.destroy();
    }
  });
});
