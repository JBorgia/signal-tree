import { afterEach, describe, expect, it } from 'vitest';

import { entityMap, signalTree, transactions } from '../index';
import { NEUTRAL_LOCATION_RUNTIME } from './internals/location-runtime';

const createTree = () =>
  signalTree(
    {
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (row) => row.id,
      }),
    },
    { enhancers: [transactions()] }
  );
type Tree = ReturnType<typeof createTree>;
const disposers: (() => void)[] = [];
const setup = () => {
  const tree = createTree();
  disposers.push(() => tree.destroy());
  tree.$.rows.addOne({ id: 'A', name: 'Original' });
  tree.$.rows.addOne({ id: 'B', name: 'Other' });
  tree.$.rows.setActiveId('A');
  return tree;
};
const observeSelection = (tree: Tree) => {
  const memo = NEUTRAL_LOCATION_RUNTIME.createDerived(() => ({
    id: tree.$.rows.activeId(),
    name: tree.$.rows.activeEntity()?.name,
  }));
  const seen = [memo()];
  disposers.push(memo.subscribe(() => seen.push(memo())));
  return { memo, seen };
};
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('entity active selection and lifetime dependencies', () => {
  it('retains selection on removal, while clear explicitly clears selection', () => {
    for (const operation of ['remove', 'clear'] as const) {
      const tree = setup();
      const held = tree.$.rows.byIdOrFail('A');
      const { memo, seen } = observeSelection(tree);
      expect(memo()).toEqual({ id: 'A', name: 'Original' });
      if (operation === 'remove') tree.$.rows.removeOne('A');
      else tree.$.rows.clear();
      expect(held()).toBeUndefined();
      expect(tree.$.rows.activeId()).toBe(
        operation === 'remove' ? 'A' : undefined
      );
      expect(memo()).toEqual({
        id: operation === 'remove' ? 'A' : undefined,
        name: undefined,
      });
      expect(seen.length).toBeGreaterThan(1);
      expect(seen.at(-1)).toEqual(memo());
    }
  });

  it('publishes restoration of the selected lifetime after its absence was observed', () => {
    const tree = setup();
    const held = tree.$.rows.byIdOrFail('A');
    const { memo, seen } = observeSelection(tree);
    const pending = tree.transact(() => tree.$.rows.removeOne('A'));
    expect(held()).toBeUndefined();
    expect(memo()).toEqual({ id: 'A', name: undefined });
    const before = seen.length;
    pending.rollback();
    expect(tree.$.rows.activeId()).toBe('A');
    expect(held()?.name).toBe('Original');
    expect(tree.$.rows.byId('A')).toBe(held);
    expect(memo()).toEqual({ id: 'A', name: 'Original' });
    expect(seen.length).toBeGreaterThan(before);
    expect(seen.at(-1)).toEqual({ id: 'A', name: 'Original' });
  });

  it('keeps the held lifetime and selection through rekeying', () => {
    const tree = setup();
    const held = tree.$.rows.byIdOrFail('A');
    const { memo, seen } = observeSelection(tree);
    tree.$.rows.changeId('A', 'renamed');
    expect(tree.$.rows.activeId()).toBe('renamed');
    expect(tree.$.rows.byId('A')).toBeUndefined();
    expect(tree.$.rows.byId('renamed')).toBe(held);
    expect(held()?.name).toBe('Original');
    expect(memo()).toEqual({ id: 'renamed', name: 'Original' });
    expect(seen.at(-1)).toEqual(memo());
    expect(seen.length).toBeGreaterThan(1);
  });

  it('resolves a selected key appearing later without retargeting a retired held node', () => {
    const tree = setup();
    const held = tree.$.rows.byIdOrFail('A');
    const { memo, seen } = observeSelection(tree);
    tree.$.rows.removeOne('A');
    expect(memo()).toEqual({ id: 'A', name: undefined });
    const before = seen.length;
    tree.$.rows.addOne({ id: 'A', name: 'Replacement' });
    expect(tree.$.rows.activeId()).toBe('A');
    expect(held()).toBeUndefined();
    expect(tree.$.rows.byId('A')).not.toBe(held);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('Replacement');
    expect(memo()).toEqual({ id: 'A', name: 'Replacement' });
    expect(seen.length).toBeGreaterThan(before);
    expect(seen.at(-1)).toEqual(memo());
  });

  it('preserves newer outside selection while restoring an absent row', () => {
    const tree = setup();
    const held = tree.$.rows.byIdOrFail('A');
    const { memo, seen } = observeSelection(tree);
    const pending = tree.transact(() => tree.$.rows.removeOne('A'));
    expect(memo()).toEqual({ id: 'A', name: undefined });
    tree.$.rows.setActiveId('B');
    expect(memo()).toEqual({ id: 'B', name: 'Other' });
    pending.rollback();
    expect(tree.$.rows.activeId()).toBe('B');
    expect(held()?.name).toBe('Original');
    expect(memo()).toEqual({ id: 'B', name: 'Other' });
    expect(seen.at(-1)).toEqual({ id: 'B', name: 'Other' });
    expect(seen).toContainEqual({ id: 'A', name: undefined });
  });

  it('tracks initial missing selection when that key first appears', () => {
    const tree = setup();
    tree.$.rows.setActiveId('missing');
    const { memo, seen } = observeSelection(tree);
    expect(memo()).toEqual({ id: 'missing', name: undefined });
    tree.$.rows.addOne({ id: 'missing', name: 'Arrived' });
    expect(tree.$.rows.activeId()).toBe('missing');
    expect(memo()).toEqual({ id: 'missing', name: 'Arrived' });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toEqual(memo());
  });
});
