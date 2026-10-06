import { describe, expect, it } from 'vitest';

import { restoration } from '../enhancers/restoration/restoration';
import type { CollectionTransitionTargetBinding } from './internals/causal-runtime/target-transition';
import {
  getMutationCaptureRuntime,
  type CollectionOrderCapture,
} from './internals/mutation-capture-runtime';
import { entityMap } from './markers/entity-map';
import { signalTree } from './signal-tree';

/**
 * The order-frontier hook (15.4.4 (a)+(d)): every collection operation that
 * replaces the order frontier publishes ONE frontier transition (an
 * operation, not a row: removeMany of three rows is one), in time order with
 * the order captures of surviving-row reorders, so a turn's first and last
 * frontier on a collection are known. Value edits and renames replace no
 * frontier and publish nothing. The transition binding reads the frontier
 * without walking the rows and installs a recorded one.
 */
type Row = { id: string; n: number };
const make = () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [restoration()] }
  );
  const seen: CollectionOrderCapture[] = [];
  const runtime =
    getMutationCaptureRuntime(tree) ?? getMutationCaptureRuntime(tree.$);
  const stop = runtime?.subscribeCollectionOrder?.((capture) =>
    seen.push(capture)
  );
  const binding = (
    tree.$.rows as unknown as {
      __prepareTransitionTarget: CollectionTransitionTargetBinding;
    }
  ).__prepareTransitionTarget;
  return { tree, seen, stop, binding };
};
const kinds = (seen: readonly CollectionOrderCapture[]) =>
  seen.map((capture) => (capture.beforeSubjects ? 'order' : 'frontier'));

describe('order frontier hook', () => {
  it('one transition per operation, chained in time order', () => {
    const { tree, seen, stop, binding } = make();
    try {
      for (const id of ['a', 'b', 'c', 'd']) tree.$.rows.addOne({ id, n: 0 });
      seen.length = 0;
      const start = binding.orderFrontier?.();
      tree.$.rows.addOne({ id: 'e', n: 0 });
      tree.$.rows.removeMany(['a', 'b', 'c']);
      tree.$.rows.updateOne('d', { n: 1 });
      tree.$.rows.changeId('d', 'd2');
      tree.$.rows.setAll([
        { id: 'e', n: 0 },
        { id: 'd2', n: 1 },
      ]);
      tree.$.rows.prependMany([{ id: 'p', n: 0 }]);
      expect(kinds(seen)).toStrictEqual([
        'frontier', // addOne
        'frontier', // removeMany, one for three rows
        'order', // setAll reordering the survivors
        'frontier', // prependMany's add
        'frontier', // prependMany's move to the front
      ]);
      expect(seen[0].beforeFrontier).toBe(start);
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i].beforeFrontier).toBe(seen[i - 1].afterFrontier);
      }
      expect(binding.orderFrontier?.()).toBe(seen.at(-1)?.afterFrontier);
    } finally {
      stop?.();
      tree.destroy();
    }
  });

  it('the binding installs a recorded token', () => {
    const { tree, stop, binding } = make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 0 });
      const token = {};
      expect(binding.orderFrontier?.(token)).toBe(token);
      expect(binding.orderFrontier?.()).toBe(token);
      expect(tree.$.rows.ids()).toStrictEqual(['a']);
    } finally {
      stop?.();
      tree.destroy();
    }
  });

  it('nothing is published without an active capture', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    });
    const runtime =
      getMutationCaptureRuntime(tree) ?? getMutationCaptureRuntime(tree.$);
    const seen: CollectionOrderCapture[] = [];
    const stop = runtime?.subscribeCollectionOrder?.((capture) =>
      seen.push(capture)
    );
    try {
      tree.$.rows.addOne({ id: 'a', n: 0 });
      tree.$.rows.removeOne('a');
      expect(seen).toStrictEqual([]);
    } finally {
      stop?.();
      tree.destroy();
    }
  });
});
