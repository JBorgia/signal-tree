import { afterEach, describe, expect, it, vi } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { transactions } from '../enhancers/transactions/transactions';
import { getOwnedPositionIds, getOwnedSubjectIds } from './internals/owned-mutation';
import { getPositionRegistry } from './internals/position-registry';
import { preparePointRealization } from './internals/causal-runtime/tree-realization-adapter';
import * as visits from './internals/visit-tree';

const trees: Array<{ destroy(): void }> = [];
afterEach(() => { vi.restoreAllMocks(); for (const t of trees.splice(0)) t.destroy(); });
function setup() {
  const tree = signalTree({ x: 0, g: { rows: entityMap<{id: string; value: number}>() }, other: entityMap<{id: string; value: number}>() }, {enhancers: [transactions()]});
  trees.push(tree);
  tree.$.g.rows.addOne({id: 'a.b', value: 0});
  tree.$.other.addOne({id: 'a.b', value: 40});
  const pending = tree.transact(() => { tree.$.x(1); tree.$.g.rows.byIdOrFail('a.b').value(1); });
  const owner = getOwnedPositionIds(tree.$.g.rows)![0];
  const subjectId = getOwnedSubjectIds(tree.$.g.rows.byIdOrFail('a.b').value)![0];
  expect(owner).toBeTypeOf('number');
  expect(subjectId).toBeTypeOf('number');
  const effects: Parameters<typeof preparePointRealization>[1] = [{ owner, subjectId, subjectFieldSegments: ['value'], before: 1, after: 0 }];
  return { tree, pending, owner, effects, registry: getPositionRegistry(tree.$)! };
}
describe('independent point owner adversarial review', () => {
  it('falls back from a stale address to a different collection without changing that collection', () => {
    const {tree, pending, owner, registry} = setup();
    const original = registry.addressFor.bind(registry);
    vi.spyOn(registry, 'addressFor').mockImplementation(p => p === owner ? ['other'] : original(p));
    const walk = vi.spyOn(visits, 'visitTree');
    pending.rollback();
    expect(walk).toHaveBeenCalled();
    expect(tree.$.x()).toBe(0);
    expect(tree.$.g.rows.byIdOrFail('a.b').value()).toBe(0);
    expect(tree.$.other.byIdOrFail('a.b').value()).toBe(40);
  });
  it.each(['ancestor', 'collection'])('does not prepare a hidden %s merely because its owner still matches', level => {
    const {tree, effects} = setup();
    if (level === 'ancestor') tree.$({x: 1, other: {all: [{id: 'a.b', value: 40}]}} as never);
    else tree.$.g({} as never);
    const parent = level === 'ancestor' ? tree.$ : tree.$.g;
    const key = level === 'ancestor' ? 'g' : 'rows';
    expect(Object.getOwnPropertyDescriptor(parent, key)?.enumerable).toBe(false);
    const walk = vi.spyOn(visits, 'visitTree');
    expect(preparePointRealization(tree, effects)).toBeUndefined();
    expect(walk).toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(parent, key)?.enumerable).toBe(false);
  });
  it('rejects preparation reentry after a successful owner lookup', () => {
    const {tree, effects, registry} = setup();
    const original = registry.addressFor.bind(registry);
    let entered = false;
    vi.spyOn(registry, 'addressFor').mockImplementation(p => {
      if (!entered) { entered = true; tree.$.x(7); }
      return original(p);
    });
    expect(() => preparePointRealization(tree, effects)).toThrow('preparation reentered installation');
    expect(entered).toBe(true);
    expect(tree.$.g.rows.byIdOrFail('a.b').value()).toBe(1);
    expect(tree.$.x()).toBe(7);
  });
  it('rejects an intervening install after preparation without changing the row', () => {
    const {tree, effects} = setup();
    const plan = preparePointRealization(tree, effects);
    expect(plan).toBeDefined();
    tree.$.x(9);
    expect(() => plan!.install()).toThrow('base revision is stale');
    expect(tree.$.g.rows.byIdOrFail('a.b').value()).toBe(1);
  });
  it('resolves the existing lifetime at its current key after rekey', () => {
    const {tree, effects} = setup();
    tree.$.g.rows.changeId('a.b', 'new.key');
    const plan = preparePointRealization(tree, effects);
    expect(plan).toBeDefined();
    plan!.install(); plan!.publish();
    expect(tree.$.g.rows.byIdOrFail('new.key').value()).toBe(0);
    expect(tree.$.g.rows.byId('a.b')).toBeUndefined();
  });
  it('cannot target a fresh same-key lifetime with the retired subject', () => {
    const {tree, effects} = setup();
    tree.$.g.rows.removeOne('a.b');
    tree.$.g.rows.addOne({id: 'a.b', value: 99});
    expect(preparePointRealization(tree, effects)).toBeUndefined();
    expect(tree.$.g.rows.byIdOrFail('a.b').value()).toBe(99);
  });
});
