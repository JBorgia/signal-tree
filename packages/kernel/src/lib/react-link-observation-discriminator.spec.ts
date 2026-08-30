import { computed } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { link } from './link';
import { signalTree } from './signal-tree';
import { withWriteContext } from './write-context';

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

describe('React observation discriminator: public link()', () => {
  it('does not publish inspection state that a React view must render', async () => {
    const tree = signalTree({ count: 0 });
    const observed: number[] = [];
    const connection = link(tree.$.count, {
      set: (value) => void observed.push(value),
    });

    withWriteContext(
      {
        intent: 'system',
        origin: 'devtools',
        participation: 'inspection',
      },
      () => tree.$.count.set(1)
    );
    await flush();
    await connection.settled();

    expect(tree.$.count()).toBe(1);
    expect(observed).toEqual([]);

    connection.dispose();
    tree.destroy();
  });

  it('cannot subscribe to a configured readonly derived cell', () => {
    const tree = signalTree(
      { count: 1 },
      {
        derived: ($) => ({ doubled: computed(() => $.count() * 2) }),
      }
    );

    expect(() =>
      link(tree.$.doubled as never, { set: () => undefined })
    ).toThrow('link: X must be an owned SignalTree location');

    tree.destroy();
  });
});
