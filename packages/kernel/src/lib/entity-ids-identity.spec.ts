import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';

// ids() is shared across value-only writes (the key snapshot is cached until a
// list or key mutation) and must change after every structural one.
type Row = { id: string; n: number };
const make = () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  tree.$.rows.setAll(['a', 'b', 'c'].map((id) => ({ id, n: 0 })));
  return tree;
};

describe('entity ids identity', () => {
  it('is reused across field writes', () => {
    const tree = make();
    const before = tree.$.rows.ids();
    tree.$.rows.updateOne('b', { n: 1 });
    tree.$.rows.updateMany(['a', 'c'], { n: 2 });
    tree.$.rows.setAll(['a', 'b', 'c'].map((id) => ({ id, n: 3 })));
    expect(tree.$.rows.ids()).toBe(before);
    tree.destroy();
  });

  it.each([
    ['addOne', (t: ReturnType<typeof make>) => t.$.rows.addOne({ id: 'd', n: 0 }), ['a', 'b', 'c', 'd']],
    ['removeOne', (t: ReturnType<typeof make>) => t.$.rows.removeOne('b'), ['a', 'c']],
    ['setAll reorder', (t: ReturnType<typeof make>) => t.$.rows.setAll(['c', 'a', 'b'].map((id) => ({ id, n: 0 }))), ['c', 'a', 'b']],
    ['changeId', (t: ReturnType<typeof make>) => t.$.rows.changeId('a', 'z'), ['z', 'b', 'c']],
    ['clear', (t: ReturnType<typeof make>) => t.$.rows.clear(), []],
    ['prependOne', (t: ReturnType<typeof make>) => t.$.rows.prependOne({ id: 'p', n: 0 }), ['p', 'a', 'b', 'c']],
  ] as const)('changes after %s', (_name, act, expected) => {
    const tree = make();
    const before = tree.$.rows.ids();
    act(tree);
    expect(tree.$.rows.ids()).not.toBe(before);
    expect(tree.$.rows.ids()).toEqual(expected);
    tree.destroy();
  });
});
