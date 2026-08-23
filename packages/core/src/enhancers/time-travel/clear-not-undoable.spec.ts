/**
 * DOCUMENTED DEFECT — `clear()` is not undoable, and fails twice over.
 *
 *     rows.setAll([a, b]);  rows.clear();
 *     tree.undo();   ->  []            silently nothing restored
 *     tree.undo();   ->  THROWS        "Unsupported scoped undo effect at
 *                                       structural-drift"
 *
 * The control is what makes it a defect rather than a limitation: removing the
 * same two rows ONE AT A TIME and undoing restores them correctly. Same
 * collection, same enhancer, same number of removals — only the API differs.
 *
 * ## Why this is pinned rather than fixed here
 *
 * NOT A REGRESSION. Reproduced unchanged at `0a23a551`, the commit the 15.0 work
 * branched from, and therefore older than that.
 *
 * Found while building the Step 8 restoration oracle, which has to traverse the
 * whole retained history and could not: the traversal threw on the entry after a
 * `clear()`. The oracle's script now omits `clear()` and this row owns the
 * behaviour instead.
 *
 * ## Severity
 *
 * `clear()` is a public `entityMap` method and `timeTravel()` is a public
 * enhancer. The first undo loses data silently — `canUndo()` returns true, the
 * call succeeds, nothing comes back — and the second throws out of a supported
 * public call. Silent first, loud second, is the worst ordering: by the time the
 * throw arrives the state is already wrong.
 *
 * It belongs on the release-hardening queue with its own root-cause commit, and
 * it should be fixed BEFORE Step 8's claim registry, because a history entry
 * whose undo semantics are broken cannot have a trustworthy claim set derived
 * from it.
 */
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './time-travel';

type Row = { id: string; v: number };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [timeTravel({ maxHistorySize: 24 })] }
  );

describe('time-travel — clear() is not undoable', () => {
  it('CONTROL: undoing individual removals restores the rows', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ]);
    await tick();

    tree.$.rows.removeOne('a');
    tree.$.rows.removeOne('b');
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);

    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['a', 'b']);
  });

  it('DEFECT: the first undo after clear() silently restores nothing', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ]);
    await tick();

    tree.$.rows.clear();
    await tick();
    expect(tree.$.rows.ids()).toEqual([]);
    // It advertises that the operation is undoable...
    expect(tree.canUndo()).toBe(true);

    tree.undo();
    await tick();

    // ...and then does not undo it. Should be ['a', 'b'].
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('DEFECT: the second undo after clear() throws', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ]);
    await tick();
    tree.$.rows.clear();
    await tick();

    tree.undo();
    await tick();

    // Throws out of a supported public call. Asserted so a fix has to come
    // here and say what the new behaviour is.
    await expect(async () => {
      tree.undo();
      await tick();
    }).rejects.toThrow(/Unsupported scoped undo effect/);
  });
});
