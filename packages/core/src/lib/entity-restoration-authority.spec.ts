import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { timeTravel } from '../enhancers/time-travel/time-travel';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * RESTORATION AUTHORITY IS PROSPECTIVE, NOT RETROACTIVE.
 *
 * Attaching a restoration-capable enhancer does not grant it rights over
 * subjects that retired before it existed. This is the contract that makes
 * reclaiming a retired subject's value backing possible at all: without it, the
 * physical layer would have to retain every retired subject forever on the
 * chance that some future enhancer might want to restore it, which would
 * require a permanently present omniscient authority.
 *
 * WHY THIS FILE EXISTS. Retired-subject backing accumulates at ~130 B/retired
 * and a correct reclaimer already exists (`subject-reclamation-coordinator`),
 * but nothing drives it. Choosing "no restoration owner existed when the
 * subject retired" as sufficient eligibility depends entirely on the rule
 * below. It is currently emergent behaviour rather than a stated contract, so
 * it is pinned here before anything is built on top of it.
 *
 * See docs/architecture/restoration-ownership-inventory.md and
 * docs/architecture/retired-subject-churn.md.
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('restoration authority is prospective', () => {
  it('gives a later-attached timeTravel no rights over an already-retired subject', async () => {
    const base = signalTree({
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (r) => r.id,
      }),
    });
    base.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    base.$.rows.removeOne('A'); // retires with NO restoration owner attached
    await tick();
    expect(base.$.rows.ids().slice().sort()).toEqual(['B']);

    const tree = base.with(timeTravel({ maxHistorySize: 20 }));
    await tick();
    tree.undo();
    await tick();

    // A never belonged to this history and must not reappear.
    expect(tree.$.rows.ids()).not.toContain('A');
  });

  it('does grant rights over a subject retired after attachment', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (r) => r.id,
      }),
    }).with(timeTravel({ maxHistorySize: 20 }));
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    tree.$.rows.removeOne('B');
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['A']);

    tree.undo();
    await tick();
    expect(tree.$.rows.ids().slice().sort()).toEqual(['A', 'B']);
  });

  it('restores field values, not just membership, for a post-attachment retirement', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (r) => r.id,
      }),
    }).with(timeTravel({ maxHistorySize: 20 }));
    tree.$.rows.setAll([{ id: 'A', name: 'Alpha' }]);
    await tick();

    tree.$.rows.removeOne('A');
    await tick();
    tree.undo();
    await tick();

    expect(tree.$.rows.byId('A')?.().name).toBe('Alpha');
  });

  it('gives later-attached transactions no rights over an already-retired subject', async () => {
    const base = signalTree({
      rows: entityMap<{ id: string; name: string }, string>({
        selectId: (r) => r.id,
      }),
    });
    base.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    base.$.rows.removeOne('A');
    await tick();

    const tree = base.with(transactions());
    await tick();

    // Whatever the transaction surface offers, none of it may resurrect A.
    expect(tree.$.rows.ids()).not.toContain('A');
    expect(tree.$.rows.byId('A')).toBeUndefined();
  });

  /**
   * NOT YET ASSERTABLE. The eligibility rule above is what makes reclaiming a
   * zero-owner retirement safe, but no production path calls
   * `runPhysicalMaintenance`, so there is nothing to observe yet. When that
   * lands, this becomes: retire with no owner attached -> maintenance reclaims
   * the backing -> attaching an owner afterwards still cannot restore it.
   *
   * Deliberately a `todo` rather than a skipped assertion: a skipped test that
   * looks like coverage is worse than an explicit gap.
   */
  it.todo(
    'reclaims backing for a subject retired with no restoration owner attached'
  );
});
