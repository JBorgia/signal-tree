import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { timeTravel } from './time-travel';

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
    { enhancers: [timeTravel({ maxHistorySize: 50 })] }
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
