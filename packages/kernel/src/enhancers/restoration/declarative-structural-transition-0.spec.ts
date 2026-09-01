import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from './restoration';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions } from '../transactions/transactions';

type Row = { id: string; value: number };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [restoration({ maxHistorySize: 10 })] }
  );

describe('RESTORATION-DECLARATIVE-STRUCTURAL-TARGET-0', () => {
  it('reverses a rekey plus fresh add into the vacated key', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll([{ id: 'k', value: 1 }]));
    await flush();
    const held = tree.$.rows.byIdOrFail('k');

    undoable(() => {
      tree.$.rows.changeId('k', 'j');
      tree.$.rows.addOne({ id: 'k', value: 2 });
    });
    await flush();

    tree.undo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['k']);
    expect(tree.$.rows.byIdOrFail('k')).toBe(held);
    expect(held()).toEqual({ id: 'k', value: 1 });

    tree.redo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['j', 'k']);
    expect(tree.$.rows.byIdOrFail('j')).toBe(held);
  });

  it('reverses a remove plus rekey into the vacated key', async () => {
    const tree = makeTree();
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'j', value: 1 },
        { id: 'k', value: 2 },
      ])
    );
    await flush();
    const heldJ = tree.$.rows.byIdOrFail('j');
    const heldK = tree.$.rows.byIdOrFail('k');

    undoable(() => {
      tree.$.rows.removeOne('j');
      tree.$.rows.changeId('k', 'j');
    });
    await flush();

    tree.undo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['j', 'k']);
    expect(tree.$.rows.byIdOrFail('j')).toBe(heldJ);
    expect(tree.$.rows.byIdOrFail('k')).toBe(heldK);

    tree.redo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['j']);
    expect(tree.$.rows.byIdOrFail('j')).toBe(heldK);
  });

  it('reverses a key permutation without exposing a temporary key', async () => {
    const tree = makeTree();
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
      ])
    );
    await flush();
    const heldA = tree.$.rows.byIdOrFail('a');
    const heldB = tree.$.rows.byIdOrFail('b');
    tree.$.rows.setActiveId('a');
    const replayedPaths: string[] = [];
    const unsubscribe = getPathNotifier().subscribe(
      '**',
      (_next, _prev, path, _ownerPath, origin) => {
        if (origin === 'restoration') {
          replayedPaths.push(path);
        }
      }
    );

    undoable(() => {
      tree.$.rows.changeId('a', '__tmp');
      tree.$.rows.changeId('b', 'a');
      tree.$.rows.changeId('__tmp', 'b');
    });
    await flush();

    tree.undo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
    expect(tree.$.rows.byIdOrFail('a')).toBe(heldA);
    expect(tree.$.rows.byIdOrFail('b')).toBe(heldB);
    expect(tree.$.rows.byId('__tmp')).toBeUndefined();
    expect(tree.$.rows.activeId()).toBe('a');

    tree.redo();
    await flush();
    unsubscribe();

    expect(tree.$.rows.ids()).toEqual(['b', 'a']);
    expect(tree.$.rows.byIdOrFail('b')).toBe(heldA);
    expect(tree.$.rows.byIdOrFail('a')).toBe(heldB);
    expect(tree.$.rows.activeId()).toBe('b');
    expect(replayedPaths.length).toBeGreaterThan(0);
    expect(replayedPaths.some((path) => path.includes('__tmp'))).toBe(false);
  });

  it('does not infer rollback dependency across collection-local SubjectIds', async () => {
    const tree = signalTree(
      {
        left: entityMap<Row, string>({ selectId: (row) => row.id }),
        right: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      { enhancers: [transactions()] }
    );

    const pending = tree.transaction(() => {
      tree.$.left.addOne({ id: 'shared', value: 1 });
    });
    tree.$.right.addOne({ id: 'shared', value: 2 });
    await flush();

    pending.rollback();
    await flush();

    expect(tree.$.left.ids()).toEqual([]);
    expect(tree.$.right.ids()).toEqual(['shared']);
  });
});
