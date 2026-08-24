import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { withWriteContext } from '../../lib/write-context';
import { timeTravel } from './restoration';
import { transactions } from './../transactions/transactions';

/**
 * HIST-0 BASELINE — descriptive, not normative.
 *
 * "What does the existing whole-tree restoration authority actually do when
 * selective-history requirements are imposed on it?" No implementation changes;
 * every case records what happens today so the failures can choose between
 * HIST-B, HIST-C and HIST-D.
 *
 * Observables per case, beyond value/history/canUndo:
 *   - which causal turn the undo targeted
 *   - which subjects hold restoration claims
 *   - whether unrelated LATER truth survived the restoration
 *   - whether transaction atomicity survived it
 *
 * The last two are what separate a genuine selective-restoration model from a
 * filtered whole-tree snapshot.
 */

type Doc = { title: string; body: string };
type Row = { id: string; name: string };

const tick = () => Promise.resolve();
const flush = async () => {
  await tick();
  await tick();
};

const makeTree = () =>
  signalTree(
    {
      document: { title: 'v1', body: 'b1' } as Doc,
      ui: { selectedPanel: 'none', scrollTop: 0 },
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    },
    { enhancers: [timeTravel({ maxHistorySize: 50 })] }
  );

const claims = (tree: unknown) =>
  getSubjectRestorationClaims(tree)?.snapshot() ?? {
    owners: 0,
    claimedSubjects: 0,
  };

describe('HIST-0 baseline: what whole-tree history does today', () => {
  it('case 1-2: authored writes to ANY branch enter history equally', async () => {
    const tree = makeTree();
    await flush();
    const start = tree.getHistory().length;

    undoable(() => tree.$.document.title.set('v2'));
    await flush();
    const afterHistorical = tree.getHistory().length;

    undoable(() => tree.$.ui.selectedPanel.set('inspector'));
    await flush();
    const afterUi = tree.getHistory().length;

    // BASELINE: there is no notion of a non-historical branch. A pure UI write
    // is indistinguishable from a document edit.
    expect(afterHistorical).toBeGreaterThan(start);
    expect(afterUi).toBeGreaterThan(afterHistorical);
  });

  it('case 3: a realization into a historical branch does NOT enter history', async () => {
    const tree = makeTree();
    undoable(() => tree.$.document.title.set('v2'));
    await flush();
    const before = tree.getHistory().length;

    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      undoable(() => tree.$.document.title.set('from-server'));
    });
    await flush();

    expect(tree.getHistory().length).toBe(before);
    expect(tree.$.document.title()).toBe('from-server');
  });

  it('CASE 5 — THE DISCRIMINATOR: one transaction spanning both branches', async () => {
    const tree = signalTree(
      {
        document: { title: 'v1', body: 'b1' } as Doc,
        ui: { selectedPanel: 'none', scrollTop: 0 },
      },
      { enhancers: [timeTravel({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();

    tree
      .transaction(() => {
        undoable(() => tree.$.document.title.set('edited'));
        undoable(() => tree.$.ui.selectedPanel.set('inspector'));
      })
      .confirm();
    await flush();

    expect(tree.$.document.title()).toBe('edited');
    expect(tree.$.ui.selectedPanel()).toBe('inspector');

    tree.undo();
    await flush();

    // BASELINE: whole-tree history reverses BOTH, because both belonged to the
    // same recorded turn. Under a location-scoped model the UI branch would be
    // excluded — and this measurement is what makes that choice consequential:
    // excluding it would partially reverse an atomically authored operation.
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.ui.selectedPanel()).toBe('none');
  });

  it('CASE 10a — intervening truth BEFORE the undone operation', async () => {
    const tree = makeTree();
    await flush();

    undoable(() => tree.$.document.title.set('A'));
    await flush();
    undoable(() => tree.$.ui.selectedPanel.set('inspector'));
    await flush();
    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      undoable(() => tree.$.document.body.set('server-body'));
    });
    await flush();
    undoable(() => tree.$.document.title.set('D'));
    await flush();

    tree.undo();
    await flush();

    expect(tree.$.document.title()).toBe('A');
    expect(tree.$.document.body()).toBe('server-body');
    expect(tree.$.ui.selectedPanel()).toBe('inspector');
  });

  it('CASE 10b — THE DISCRIMINATOR: truth arriving AFTER the undone operation', async () => {
    // 10a does NOT discriminate, and the first version of this suite stopped
    // there. A whole-tree snapshot rewind and a per-turn effect reversal give
    // the SAME answer when the intervening writes happened before the undone
    // operation, because they are already inside its prior snapshot.
    //
    // The separating case is truth that lands AFTER:
    //   snapshot rewind    -> body reverts to 'b1', the server value is lost
    //   per-turn reversal  -> body keeps 'server-body'
    const tree = makeTree();
    await flush();

    undoable(() => tree.$.document.title.set('A'));
    await flush();

    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      undoable(() => tree.$.document.body.set('server-body'));
    });
    await flush();

    tree.undo();
    await flush();

    // THE FINDING. The engine reverses the OPERATION'S OWN EFFECTS and leaves
    // later non-restorable truth standing. Restoration is already
    // operation-scoped in its mechanics; what is whole-tree is ELIGIBILITY.
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.document.body()).toBe('server-body');
  });

  it('case 7: entity identity survives an undo of a structural edit', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Boo' },
    ]);
    await flush();
    const held = tree.$.rows.byIdOrFail('a');

    undoable(() => tree.$.rows.removeOne('a'));
    await flush();
    expect(held()).toBeUndefined();

    tree.undo();
    await flush();

    // The subject LIFETIME comes back, not an equivalent row.
    expect(held()?.name).toBe('Ada');
  });

  it('case 9: what holds restoration claims when only part of the tree is "historical"', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll([{ id: 'a', name: 'Ada' }]));
    await flush();

    const withRows = claims(tree);

    // A burst of pure-UI churn. Under a selective model none of this is
    // restorable, so none of it should acquire restoration rights.
    for (let i = 0; i < 20; i++) {
      undoable(() => tree.$.ui.scrollTop.set(i));
      await flush();
    }

    const afterUiChurn = claims(tree);

    // BASELINE: UI writes are ordinary authored turns, so they occupy history
    // entries. What this records is whether they also cause SUBJECT claims to
    // accumulate — the retention half of the question.
    expect(afterUiChurn.owners).toBeGreaterThanOrEqual(withRows.owners);
    expect(typeof afterUiChurn.claimedSubjects).toBe('number');
  });
});
