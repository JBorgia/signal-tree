/**
 * `clear()` IS UNDOABLE — fixed in 15.0, pinned so it cannot silently regress.
 *
 * It was not. `clear()` tombstoned every subject and told the notifier nothing,
 * so the turn timeTravel recorded carried no structural effect:
 *
 *     rows.setAll([a, b]);  rows.clear();
 *     tree.canUndo()  ->  true
 *     tree.undo();    ->  []       nothing restored, silently
 *     tree.undo();    ->  THROWS   "Unsupported scoped undo effect at
 *                                   structural-drift"
 *
 * Silent first, loud second, is the worst ordering: by the time the throw
 * arrives the history model and the realized state have already diverged.
 *
 * The CONTROL is what made it a defect rather than a limitation, and it is kept
 * below: removing the same two rows one at a time and undoing restored them
 * correctly. Same collection, same enhancer, same number of removals — only the
 * API differed.
 *
 * THE FIX. `clear()` now authors the same structural `remove` effects
 * `removeMany` does, one per subject, with the value and neighbour subjects
 * captured BEFORE anything is tombstoned. It is deliberately not a special
 * "undo clear" path that rebuilds from a snapshot: restoration has to bring back
 * the SUBJECT LIFETIMES, not equivalent rows at the same keys, and the held-
 * reference row below is what holds that line.
 *
 * It also stopped calling `resetEntitySignals()`. Dropping every entity signal
 * saved nothing a restorer can afford — a held reference has to keep reading
 * through the same signal so an undo re-publishes into it, which is the property
 * `check-signal-identity-durability.mjs` pins for `removeOne`. Zero-owner trees
 * still shed those entries through reclamation.
 *
 * Found by the Step 8 restoration oracle, whose traversal could not get past a
 * `clear()`. Pre-existing: reproduced at `0a23a551`, the 15.0 branch point.
 */
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './restoration';

type Row = { id: string; v: number };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [timeTravel({ maxHistorySize: 24 })] }
  );

const seeded = async () => {
  const tree = makeTree();
  // Designated because a test below undoes PAST this seeding — it is an
  // operation whose reversal is under test, not incidental setup.
  undoable(() =>
    tree.$.rows.setAll([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ])
  );
  await tick();
  return tree;
};

describe('time-travel — clear() is undoable', () => {
  it('CONTROL: undoing individual removals restores the rows', async () => {
    const tree = await seeded();

    undoable(() => tree.$.rows.removeOne('a'));
    undoable(() => tree.$.rows.removeOne('b'));
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);

    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['a', 'b']);
  });

  it('restores every row the clear removed', async () => {
    const tree = await seeded();

    undoable(() => tree.$.rows.clear());
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.canUndo()).toBe(true);

    tree.undo();
    await tick();

    expect(tree.$.rows.ids().slice().sort()).toEqual(['a', 'b']);
    expect(tree.$.rows.byId('a')?.()).toEqual({ id: 'a', v: 1 });
    expect(tree.$.rows.byId('b')?.()).toEqual({ id: 'b', v: 2 });
  });

  it('restores the SUBJECT LIFETIME, not an equivalent row at the same key', async () => {
    // The distinction the fix exists to preserve. A reference held before the
    // clear must start reading again after the undo; if restoration
    // manufactured a new subject at key 'a', the held reference would stay
    // undefined and only a fresh lookup would work.
    const tree = await seeded();
    const held = tree.$.rows.byId('a');
    expect(held?.()).toEqual({ id: 'a', v: 1 });

    undoable(() => tree.$.rows.clear());
    await tick();
    expect(held?.()).toBeUndefined();

    tree.undo();
    await tick();
    expect(held?.()).toEqual({ id: 'a', v: 1 });
  });

  it('keeps traversing past the clear without throwing', async () => {
    // The second undo used to throw "Unsupported scoped undo effect at
    // structural-drift". It now walks back past the seeding setAll.
    const tree = await seeded();
    undoable(() => tree.$.rows.clear());
    await tick();

    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['a', 'b']);

    tree.undo();
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('redoes the clear', async () => {
    const tree = await seeded();
    undoable(() => tree.$.rows.clear());
    await tick();
    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['a', 'b']);

    tree.redo();
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('survives clear -> undo -> re-clear', async () => {
    const tree = await seeded();

    undoable(() => tree.$.rows.clear());
    await tick();
    tree.undo();
    await tick();
    undoable(() => tree.$.rows.clear());
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);

    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['a', 'b']);
  });

  it('does not resurrect a cleared row through key reuse', async () => {
    // Stale-handle isolation still holds across a clear: a fresh row at a
    // reused key is a different subject, and the old handle must not follow it.
    const tree = await seeded();
    const held = tree.$.rows.byId('a');

    undoable(() => tree.$.rows.clear());
    await tick();
    undoable(() => tree.$.rows.addOne({ id: 'a', v: 99 }));
    await tick();

    expect(tree.$.rows.byId('a')?.()).toEqual({ id: 'a', v: 99 });
    expect(held?.()).toBeUndefined();
  });
});
