import { computed } from '@angular/core';
import { signalTree } from './signal-tree';

describe('F4: tree() must not lock out .derived()', () => {
  it('allows .derived() after a read through tree()', () => {
    const tree = signalTree({ n: 1 });
    expect((tree() as { n: number }).n).toBe(1);

    const extended = tree.derived(($) => ({ dbl: computed(() => $.n() * 2) }));
    expect(extended.$.dbl()).toBe(2);
  });

  it('allows .derived() after a write through tree()', () => {
    const tree = signalTree({ n: 1 });
    (tree as unknown as (v: object) => void)({ n: 5 });

    const extended = tree.derived(($) => ({ dbl: computed(() => $.n() * 2) }));
    expect(extended.$.dbl()).toBe(10);
  });

});
