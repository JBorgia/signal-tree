import { afterEach, describe, expect, it } from 'vitest';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { external } from '../../lib/external';
import { undoable } from '../../lib/undoable';
import { getPathNotifier } from '../../lib/path-notifier';
import { restoration } from '../restoration/restoration';
import { batching } from './batching';
import { transactions } from '../transactions/transactions';
const owned: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of owned.splice(0)) tree.destroy();
  getPathNotifier()?.flushSync();
});
describe('deferred writes preserve classification and location identity', () => {
  for (const reverse of [false, true])
    it(`external write stays outside undo (order ${reverse})`, () => {
      const tree = signalTree(
        { x: 0 },
        {
          enhancers: reverse
            ? [restoration(), batching()]
            : [batching(), restoration()],
        }
      );
      owned.push(tree);
      undoable(() => tree.coalesce(() => external(() => tree.$.x(7))));
      getPathNotifier()?.flushSync();
      expect(tree.$.x()).toBe(7);
      expect(tree.canUndo()).toBe(false);
    });
  it('designation inside coalesce survives scope exit', () => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: [batching(), restoration()] }
    );
    owned.push(tree);
    tree.coalesce(() => undoable(() => tree.$.x(7)));
    getPathNotifier()?.flushSync();
    expect(tree.canUndo()).toBe(true);
    tree.undo();
    expect(tree.$.x()).toBe(0);
  });
  it('distinct physical locations with same displayed path do not collide', () => {
    const tree = signalTree(
      { 'a.b': 0, a: { b: 0 } },
      { enhancers: [batching()] }
    );
    owned.push(tree);
    tree.coalesce(() => {
      tree.$['a.b'](1);
      tree.$.a.b(2);
    });
    expect(tree.$['a.b']()).toBe(1);
    expect(tree.$.a.b()).toBe(2);
  });
  it('coalesces fields materialized after tree construction', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }>() },
      { enhancers: [batching()] }
    );
    owned.push(tree);
    tree.$.rows.addOne({ id: 'a.b', value: 0 });
    const seen: number[] = [];
    const field = tree.$.rows.byIdOrFail('a.b').value;
    const stop = field.subscribe(() => seen.push(field()));
    try {
      tree.coalesce(() => {
        field(1);
        field(2);
        expect(field()).toBe(0);
      });
      expect(field()).toBe(2);
      expect(seen).toEqual([2]);
    } finally {
      stop();
    }
  });
  it('intercepts fields created inside coalesce without affecting another tree', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }>() },
      { enhancers: [batching()] }
    );
    const other = signalTree({
      rows: entityMap<{ id: string; value: number }>(),
    });
    owned.push(tree, other);
    other.$.rows.addOne({ id: 'a', value: 0 });
    tree.coalesce(() => {
      tree.$.rows.addOne({ id: 'a', value: 0 });
      const field = tree.$.rows.byIdOrFail('a').value;
      field(1);
      field(2);
      other.$.rows.byIdOrFail('a').value(3);
      expect(field()).toBe(0);
      expect(other.$.rows.byIdOrFail('a').value()).toBe(3);
    });
    expect(tree.$.rows.byIdOrFail('a').value()).toBe(2);
  });
  it('coalesce inside transaction stays in the pending turn', () => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: [batching(), transactions()] }
    );
    owned.push(tree);
    const pending = tree.transact(() => tree.coalesce(() => tree.$.x(7)));
    expect(tree.$.x()).toBe(7);
    pending.rollback();
    expect(tree.$.x()).toBe(0);
  });
  it('transaction inside coalesce cannot silently escape its callback lifetime', () => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: [batching(), transactions()] }
    );
    owned.push(tree);
    let pending: { rollback(): void } | undefined;
    let refused = false;
    try {
      tree.coalesce(() => {
        pending = tree.transact(() => tree.$.x(7));
      });
    } catch {
      refused = true;
    }
    if (refused) {
      expect(tree.$.x()).toBe(0);
    } else {
      expect(tree.$.x()).toBe(7);
      pending?.rollback();
      expect(tree.$.x()).toBe(0);
    }
  });
});
