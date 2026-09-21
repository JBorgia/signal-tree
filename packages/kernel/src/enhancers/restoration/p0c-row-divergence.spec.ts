import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { restoration } from './restoration';

/**
 * P0-C-ROW — does the provenance guard reach an ENTITY ROW FIELD?
 *
 * P0-C records external truth by scalar path and resolves the live value from
 * `tree.$`. A row field may not resolve that way, and the check skips rather
 * than refuses when it cannot resolve — biased against false refusals.
 *
 * That bias is only acceptable if row fields are covered by something else.
 * `entityMap` is central enough that "tree-level scalars only" would be a
 * product limitation to choose deliberately, not to discover later.
 *
 * MUST NOT happen:
 *
 *   name -> 'orig'      later external truth silently discarded
 *
 * Acceptable:
 *
 *   ST1034 refusal, or any existing guard proving equivalent safety, with the
 *   server value intact and the cursor unmoved.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [restoration({ maxHistorySize: 50 })] }
  );

describe('P0-C-ROW: entity row field divergence', () => {
  it('an authored row edit superseded by a realization must not be discarded', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll([{ id: 'a', name: 'orig' }]));
    await flush();

    undoable(() => tree.$.rows.updateOne('a', { name: 'USER' }));
    await flush();
    const indexBefore = tree.getCurrentIndex();

    realization(() => tree.$.rows.updateOne('a', { name: 'SERVER' }));
    await flush();
    expect(tree.$.rows.byId('a')?.()?.name).toBe('SERVER');

    let refused = false;
    try {
      tree.undo();
    } catch {
      refused = true;
    }
    await flush();

    const name = tree.$.rows.byId('a')?.()?.name;

    // THE REQUIREMENT. Whether it refuses or is covered by another guard, the
    // one outcome that is not acceptable is silently reverting to 'orig'.
    expect(name).not.toBe('orig');
    expect(name).toBe('SERVER');

    if (refused) {
      // A refusal is not a navigation.
      expect(tree.getCurrentIndex()).toBe(indexBefore);
    }
  });

  it('CONTROL — the same row edit with NO realization still undoes', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll([{ id: 'a', name: 'orig' }]));
    await flush();

    undoable(() => tree.$.rows.updateOne('a', { name: 'USER' }));
    await flush();

    tree.undo();
    await flush();

    // Without this the case above could pass simply because row undo is broken.
    expect(tree.$.rows.byId('a')?.()?.name).toBe('orig');
  });
});

type Order = { id: string; priority: string; status: string };
const makeOrders = () =>
  signalTree(
    { rows: entityMap<Order, string>({ selectId: (row) => row.id }) },
    { enhancers: [restoration()] }
  );

for (const api of ['field', 'updateOne'] as const) {
  const write = (
    tree: ReturnType<typeof makeOrders>,
    key: 'priority' | 'status',
    value: string
  ) => {
    if (api === 'field') tree.$.rows.byIdOrFail('a')[key](value);
    else tree.$.rows.updateOne('a', { [key]: value });
  };

  describe(`entity external provenance via ${api}`, () => {
    it('undo and redo preserve external sibling updates across repeated turns', async () => {
      const tree = makeOrders();
      try {
        realization(() =>
          tree.$.rows.addOne({
            id: 'a',
            priority: 'Standard',
            status: 'Packing',
          })
        );
        await flush();
        undoable(() => write(tree, 'priority', 'Rush'));
        await flush();
        realization(() => write(tree, 'status', 'Shipped'));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.byIdOrFail('a')()).toEqual({
          id: 'a',
          priority: 'Standard',
          status: 'Shipped',
        });
        realization(() => write(tree, 'status', 'Delivered'));
        await flush();
        tree.redo();
        await flush();
        expect(tree.$.rows.byIdOrFail('a')()).toEqual({
          id: 'a',
          priority: 'Rush',
          status: 'Delivered',
        });
        tree.undo();
        await flush();
        expect(tree.$.rows.byIdOrFail('a').priority()).toBe('Standard');
        expect(tree.$.rows.byIdOrFail('a').status()).toBe('Delivered');
      } finally {
        tree.destroy();
      }
    });

    it('an authored sibling write must not erase an external conflict', async () => {
      const tree = makeOrders();
      try {
        tree.$.rows.addOne({
          id: 'a',
          priority: 'Standard',
          status: 'Packing',
        });
        await flush();
        undoable(() => write(tree, 'priority', 'Rush'));
        await flush();
        realization(() => write(tree, 'priority', 'Server priority'));
        await flush();
        undoable(() => write(tree, 'status', 'Local status'));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.byIdOrFail('a').status()).toBe('Packing');
        const index = tree.getCurrentIndex();
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.getCurrentIndex()).toBe(index);
        expect(tree.$.rows.byIdOrFail('a').priority()).toBe('Server priority');
      } finally {
        tree.destroy();
      }
    });

    it('refuses the whole operation if one edited field conflicts', async () => {
      const tree = makeOrders();
      try {
        tree.$.rows.addOne({
          id: 'a',
          priority: 'Standard',
          status: 'Packing',
        });
        await flush();
        undoable(() => {
          write(tree, 'priority', 'Rush');
          write(tree, 'status', 'Local status');
        });
        await flush();
        realization(() => write(tree, 'status', 'Shipped'));
        await flush();
        const index = tree.getCurrentIndex();
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.getCurrentIndex()).toBe(index);
        expect(tree.$.rows.byIdOrFail('a')()).toEqual({
          id: 'a',
          priority: 'Rush',
          status: 'Shipped',
        });
      } finally {
        tree.destroy();
      }
    });
  });
}

it('preserves external conflict protection after undoing a rekey', async () => {
  const tree = makeOrders();
  try {
    tree.$.rows.addOne({ id: 'a', priority: 'Standard', status: 'Packing' });
    await flush();
    undoable(() => tree.$.rows.updateOne('a', { priority: 'Rush' }));
    await flush();
    realization(() => tree.$.rows.updateOne('a', { priority: 'Server' }));
    await flush();
    undoable(() => tree.$.rows.changeId('a', 'b'));
    await flush();
    tree.undo();
    await flush();
    const index = tree.getCurrentIndex();
    expect(() => tree.undo()).toThrow(/ST1034/);
    expect(tree.getCurrentIndex()).toBe(index);
    expect(tree.$.rows.byIdOrFail('a').priority()).toBe('Server');
  } finally {
    tree.destroy();
  }
});
