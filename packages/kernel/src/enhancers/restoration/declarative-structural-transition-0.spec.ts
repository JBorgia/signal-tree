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

  it('A: composes cross-turn add and remove to net absence', async () => {
    const tree = signalTree(
      {
        count: 0,
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    undoable(() => tree.$.count.set(2));
    await flush();
    undoable(() => tree.$.rows.setAll([{ id: 'r1', value: 1 }]));
    await flush();
    undoable(() => tree.$.rows.clear());
    await flush();

    expect(() => tree.jumpTo(0)).not.toThrow();
    await flush();

    expect(tree.$.count()).toBe(2);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('B: composes cross-turn restores into exact SubjectId order', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.addOne({ id: 'r1', value: 1 }));
    await flush();
    undoable(() => tree.$.rows.removeOne('r1'));
    await flush();
    undoable(() => tree.$.rows.addOne({ id: 'r3', value: 3 }));
    await flush();
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'r1', value: 1 },
        { id: 'r2', value: 2 },
        { id: 'r3', value: 3 },
      ])
    );
    await flush();

    tree.undo();
    tree.undo();
    tree.redo();
    tree.redo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['r1', 'r2', 'r3']);
    const internal = tree.$.rows as unknown as {
      __acquireEntityHandleForTesting(id: string): { subjectId: number };
    };
    expect(
      tree.$.rows.ids().map(
        (id) => internal.__acquireEntityHandleForTesting(id).subjectId
      )
    ).toEqual([3, 4, 2]);
  });

  it('C: composes chained rekeys into the historical target mapping', async () => {
    const tree = makeTree();
    undoable(() =>
      tree.$.rows.setAll([
        { id: 'r1', value: 1 },
        { id: 'r2', value: 2 },
        { id: 'r3', value: 3 },
      ])
    );
    await flush();
    undoable(() => tree.$.rows.removeOne('r3'));
    await flush();
    undoable(() => tree.$.rows.changeId('r2', 'r3'));
    await flush();
    undoable(() => tree.$.rows.changeId('r1', 'r2'));
    await flush();

    const manager = (tree as unknown as {
      __restoration: {
        history: Array<{ state: unknown }>;
      };
    }).__restoration;
    for (const turn of manager.history) {
      turn.state = { poisoned: true };
    }

    expect(() => tree.jumpTo(1)).not.toThrow();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['r1', 'r2']);
    const internal = tree.$.rows as unknown as {
      __acquireEntityHandleForTesting(id: string): { subjectId: number };
    };
    expect(internal.__acquireEntityHandleForTesting('r1').subjectId).toBe(1);
    expect(internal.__acquireEntityHandleForTesting('r2').subjectId).toBe(2);
  });

  it('prepares both temporal jump directions before installing either', async () => {
    const tree = signalTree(
      { left: 0, right: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 })] }
    );
    undoable(() => tree.$.left.set(1));
    await flush();
    undoable(() => tree.$.right.set(1));
    await flush();
    const manager = (tree as unknown as {
      __restoration: {
        history: Array<{
          historyIndex: number;
          __positionIds?: number[];
          __effects?: Array<{ position: number }>;
        }>;
        undoPosition(positionId: number): number[];
      };
    }).__restoration;
    const first = manager.history[0];
    const firstPosition = first.__positionIds?.[0];
    if (firstPosition === undefined || !first.__effects?.[0]) {
      throw new Error('Expected first scalar turn metadata');
    }
    manager.undoPosition(firstPosition);
    expect(tree.$.left()).toBe(0);
    expect(tree.$.right()).toBe(1);

    first.__effects[0].position = 999_999;

    expect(() => tree.jumpTo(first.historyIndex)).toThrow(
      'Declarative scalar target has no slot'
    );
    expect(tree.$.left()).toBe(0);
    expect(tree.$.right()).toBe(1);
  });
});
