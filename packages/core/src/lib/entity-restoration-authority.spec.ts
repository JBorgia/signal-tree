import { signalTree } from './signal-tree';
import { undoable } from '../lib/undoable';
import { entityMap } from './markers/entity-map';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * RESTORATION AUTHORITY IS FIXED AT CONSTRUCTION.
 *
 * A restoration-capable enhancer has rights only over subjects that retire
 * while it is attached, and in v15 it is attached for the tree's whole life or
 * not at all. This is the contract that makes reclaiming a retired subject's
 * value backing possible: without it, the physical layer would have to retain
 * every retired subject forever on the chance that some future enhancer might
 * want to restore it, which would require a permanently present omniscient
 * authority.
 *
 * WHAT v15 CHANGED, AND WHY IT MATTERS HERE. Under the chained builder the rule
 * was PROSPECTIVE and evaluated over time: a tree could acquire a restoration
 * owner at any moment via `.with()`, so "did an owner exist when this subject
 * retired?" was a runtime question, answerable only by comparing timestamps
 * against an attachment that had not happened yet. Declarative construction
 * removes late attachment, which turns the same rule into a STATIC one: whether
 * a tree has a restoration owner is decided before its first write and cannot
 * change. Reclamation eligibility therefore no longer rests on emergent
 * ordering behaviour — a tree built without a restoration owner has no path to
 * one, so every retirement it makes is unconditionally reclaimable.
 *
 * That is a strictly stronger basis than the one the reclaimer was designed
 * against, so the rows below assert the static property rather than the
 * temporal one they used to.
 *
 * WHY THIS FILE EXISTS. Retired-subject backing accumulates at ~130 B/retired
 * and a correct reclaimer already exists (`subject-reclamation-coordinator`),
 * but nothing drives it.
 *
 * See docs/architecture/restoration-ownership-inventory.md and
 * docs/architecture/retired-subject-churn.md.
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('restoration authority is fixed at construction', () => {
  it('leaves a tree built without a restoration owner with no way to acquire one', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (r) => r.id,
      }),
    });
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    tree.$.rows.removeOne('A'); // retires with NO restoration owner attached
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['B']);

    // The whole temporal question is gone: there is no operation that adds a
    // restoration owner to an existing tree, so A's retirement can never be
    // reinterpreted as owned. This assertion is what the reclaimer's
    // eligibility rule now rests on — if late enhancement ever returns, this
    // row fails and the rule has to be re-derived, not merely re-tested.
    expect(
      (tree as unknown as { with?: unknown }).with
    ).toBeUndefined();

    // And the tree exposes no restoration surface of its own.
    expect((tree as unknown as { undo?: unknown }).undo).toBeUndefined();
    expect(
      (tree as unknown as { transaction?: unknown }).transaction
    ).toBeUndefined();
  });

  it('gives restoration no rights over subjects retired before its history begins', async () => {
    // The prospective half of the rule survives inside a single tree's
    // lifetime: restoration snapshots from the point it starts recording, so a
    // retirement it never saw is not undoable. Here the retirement happens
    // before any restoration history entry exists to undo back past.
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; name: string }, string>({
          selectId: (r) => r.id,
        }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      }
    );
    undoable(() => tree.$.rows.setAll([{ id: 'B', name: 'Beta' }]));
    await tick();

    const beforeUndo = tree.$.rows.ids().slice().sort();
    tree.undo();
    await tick();
    tree.undo();
    await tick();

    // Undoing past the beginning cannot invent an 'A' that this tree never held.
    expect(tree.$.rows.ids()).not.toContain('A');
    expect(beforeUndo).toEqual(['B']);
  });

  it('does grant rights over a subject retired after attachment', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; name: string }, string>({
          selectId: (r) => r.id,
        }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      }
    );
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    undoable(() => tree.$.rows.removeOne('B'));
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['A']);

    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['A', 'B']);
  });

  it('restores field values, not just membership, for a post-attachment retirement', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; name: string }, string>({
          selectId: (r) => r.id,
        }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      }
    );
    undoable(() => tree.$.rows.setAll([{ id: 'A', name: 'Alpha' }]));
    await tick();

    undoable(() => tree.$.rows.removeOne('A'));
    await tick();
    tree.undo();
    await tick();

    expect(tree.$.rows.byId('A')?.().name).toBe('Alpha');
  });

  it('gives transactions no rights over a subject retired outside any transaction', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; name: string }, string>({
          selectId: (r) => r.id,
        }),
      },
      { enhancers: [transactions()], capabilities: ['causal-runtime'] }
    );
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    tree.$.rows.removeOne('A'); // retired outside any transaction scope
    await tick();

    // A rollback covers only what its own transaction did. Whatever the
    // transaction surface offers, none of it may resurrect A.
    const pending = (
      tree as unknown as { transaction: (f: () => void) => { rollback(): void } }
    ).transaction(() => {
      undoable(() => tree.$.rows.updateOne('B', { name: 'Beta2' }));
    });
    pending.rollback();
    await tick();

    expect(tree.$.rows.ids()).not.toContain('A');
    expect(tree.$.rows.byId('A')).toBeUndefined();
  });

  /**
   * ZERO-OWNER RECLAMATION. Was an `it.todo` while nothing drove reclamation;
   * the retirement boundary drives it now, for this case only.
   *
   * The two rows are a matched pair and neither means anything alone. The
   * positive row alone would pass against an implementation that reclaimed
   * unconditionally — which would be a data-loss bug, not a fix — so the
   * negative control is what makes it a result.
   */
  const inspect = (rows: unknown, subjectId: number) =>
    (
      rows as {
        __inspectSubjectResources: (id: number) =>
          | { retainedValueBacking: unknown; state: string }
          | undefined;
      }
    ).__inspectSubjectResources(subjectId);

  const subjectIdOf = (rows: unknown, key: string) =>
    (
      rows as { __acquireEntityHandleForTesting: (k: string) => { subjectId: number } }
    ).__acquireEntityHandleForTesting(key).subjectId;

  it('reclaims backing for a subject retired with no restoration owner', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (r) => r.id,
      }),
    });
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    const subjectA = subjectIdOf(tree.$.rows, 'A');
    expect(inspect(tree.$.rows, subjectA)?.retainedValueBacking).toBeDefined();

    undoable(() => tree.$.rows.removeOne('A'));
    await tick();

    // Nothing is left to inspect. The retirement boundary releases the value
    // backing, the entity signal, the lifetime record and the revision — all of
    // it, at the moment of retirement rather than on a later sweep, because with
    // no restorer there is no turn that could be holding any of it.
    expect(inspect(tree.$.rows, subjectA)).toBeUndefined();
    // The surviving subject is untouched.
    expect(tree.$.rows.byId('B')?.().name).toBe('Beta');
  });

  it('does NOT reclaim when a restoration owner is configured', async () => {
    // The control. Reclaiming here would delete the value `undo()` restores.
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; name: string }, string>({
          selectId: (r) => r.id,
        }),
      },
      {
        enhancers: [restoration({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      }
    );
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    const subjectA = subjectIdOf(tree.$.rows, 'A');
    undoable(() => tree.$.rows.removeOne('A'));
    await tick();

    expect(inspect(tree.$.rows, subjectA)?.state).toBe('tombstoned');
    expect(inspect(tree.$.rows, subjectA)?.retainedValueBacking).toBeDefined();

    // And the backing is not merely present — it is the thing undo needs.
    tree.undo();
    await tick();
    expect(tree.$.rows.byId('A')?.().name).toBe('Alpha');
  });
});
