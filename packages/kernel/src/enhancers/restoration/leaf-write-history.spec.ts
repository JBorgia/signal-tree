import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { restoration } from './restoration';

/**
 * Direct leaf writes must land in history.
 *
 * `tree.$.a.b(x)` writes straight to its location — it does not pass through
 * the root location that restoration wraps. If history does not see it, undo
 * silently cannot restore it.
 *
 * `interceptLeafSignals` routes those writes through the PathNotifier so the
 * flush hook records them. These tests pin that, because it is invisible from
 * the outside until it breaks.
 */
describe('restoration records direct leaf writes', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('undo restores a direct leaf replacement', async () => {
    const tree = signalTree(
      { user: { profile: { name: 'a' } } },
      { enhancers: [restoration()] }
    );

    undoable(() => tree.$.user.profile.name('b'));
    await flush();
    undoable(() => tree.$.user.profile.name('c'));
    await flush();
    expect(tree.$().user.profile.name).toBe('c');

    tree.undo();
    expect(tree.$().user.profile.name).toBe('b');
  });

  it('undo restores a direct leaf updater', async () => {
    const tree = signalTree({ count: 0 }, { enhancers: [restoration()] });

    undoable(() => tree.$.count((n) => n + 1));
    await flush();
    undoable(() => tree.$.count((n) => n + 1));
    await flush();
    expect(tree.$().count).toBe(2);

    tree.undo();
    expect(tree.$().count).toBe(1);
  });

  it('records leaf writes at depth', async () => {
    const tree = signalTree(
      { a: { b: { c: { d: 1 } } } },
      { enhancers: [restoration()] }
    );

    undoable(() => tree.$.a.b.c.d(2));
    await flush();
    expect(tree.$().a.b.c.d).toBe(2);

    tree.undo();
    expect(tree.$().a.b.c.d).toBe(1);
  });

  it('redo replays a leaf write that undo rolled back', async () => {
    const tree = signalTree({ n: 1 }, { enhancers: [restoration()] });

    undoable(() => tree.$.n(2));
    await flush();
    tree.undo();
    expect(tree.$().n).toBe(1);

    tree.redo();
    expect(tree.$().n).toBe(2);
  });

  it('does not grow history while restoring', async () => {
    const tree = signalTree({ n: 1 }, { enhancers: [restoration()] });

    undoable(() => tree.$.n(2));
    await flush();
    undoable(() => tree.$.n(3));
    await flush();
    const before = tree.getRestorationHistory().length;

    tree.undo();
    await flush();

    expect(tree.getRestorationHistory().length).toBeLessThanOrEqual(before);
  });

  it('undo on a tree with entity collections keeps redo and records no phantom entry', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()] }
    );

    undoable(() => tree.$.rows.addOne({ id: 1, name: 'a' }));
    await flush();
    undoable(() => tree.$.rows.addOne({ id: 2, name: 'b' }));
    await flush();
    undoable(() => tree.$.rows.addOne({ id: 3, name: 'c' }));
    await flush();

    const before = tree.getRestorationHistory().length;

    tree.undo();
    await flush();

    const afterUndo = tree.$() as unknown as {
      rows: { all: Array<{ id: number; name: string }> };
    };

    expect(tree.getRestorationHistory().length).toBe(before);
    expect(tree.canRedo()).toBe(true);
    expect(afterUndo.rows.all.map((row) => row.id)).toEqual([1, 2]);

    tree.redo();
    const afterRedo = tree.$() as unknown as {
      rows: { all: Array<{ id: number; name: string }> };
    };
    expect(afterRedo.rows.all.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});
