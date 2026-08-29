import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { restoration } from './restoration';

/**
 * STEP 8 PHASE 6A — the multi-collection falsifier, run BEFORE the sink is
 * allowed to delete anything.
 *
 * `SubjectRestorationClaims` is TREE-scoped and indexes subjects by `number`.
 * `StructuralStore` is COLLECTION-scoped and starts `nextSubjectId` at 1. So a
 * tree with two entityMaps contains two different subjects both called 1, and
 * the Phase 2 oracle — one collection — could not see that.
 *
 * The proposition the destructive sink is about to rely on is:
 *
 *     last claim released  =>  nothing in this tree can legally require this
 *                              physical backing any more
 *
 * Under numeric collapsing that is either conservative or wrong, and which one
 * it is decides the shape of the sink:
 *
 *   SAFE, CONSERVATIVE   a claim anywhere on numeric 1 keeps numeric 1 claimed
 *                        tree-wide, so no collection's retired 1 is offered
 *                        while any collection needs its own 1. Over-retains.
 *                        The sink can then BROADCAST an unowned number to every
 *                        registered physical owner and let each decide, because
 *                        the number cannot route uniquely.
 *
 *   UNSAFE               some ordering frees a number while a collection still
 *                        needs its own. Then claims must carry a collection
 *                        identity and the RC scope grows.
 *
 * These tests must also prove the collision is REAL rather than assumed: if
 * both collections did not actually allocate the same number, everything below
 * would pass vacuously.
 */

type User = { id: string; name: string };
type Order = { id: string; total: number };

const tick = () => Promise.resolve();

const makeTree = (maxHistorySize = 4) =>
  signalTree(
    {
      users: entityMap<User, string>({ selectId: (u) => u.id }),
      orders: entityMap<Order, string>({ selectId: (o) => o.id }),
    },
    { enhancers: [restoration({ maxHistorySize })] }
  );

type Collection = {
  __acquireEntityHandleForTesting?: (
    id: string
  ) => { subjectId: number } | undefined;
  __inspectSubjectResources?: (subjectId: number) =>
    | {
        state: string;
        retainedValueBacking?: { kind: string } | undefined;
      }
    | undefined;
  __listSubjectReclamationCandidates?: () => readonly number[];
};

const subjectOf = (collection: unknown, id: string): number => {
  const handle = (collection as Collection).__acquireEntityHandleForTesting?.(
    id
  );
  if (!handle) {
    throw new Error(`No handle for ${id}`);
  }
  return handle.subjectId;
};

const retiredIn = (collection: unknown): readonly number[] =>
  (collection as Collection).__listSubjectReclamationCandidates?.() ?? [];

describe('multi-collection subject id collision', () => {
  it('THE PREMISE: two collections in one tree allocate the same numbers', async () => {
    const tree = makeTree();
    undoable(() => tree.$.users.setAll([{ id: 'u1', name: 'a' }]));
    undoable(() => tree.$.orders.setAll([{ id: 'o1', total: 1 }]));
    await tick();
    await tick();

    const user = subjectOf(tree.$.users, 'u1');
    const order = subjectOf(tree.$.orders, 'o1');

    // If this ever stops holding — because subject allocation becomes
    // tree-global — every other test in this file is measuring nothing, and
    // the numeric-collapsing analysis in the sink can be deleted.
    expect(user).toBe(order);
  });

  it('a claim from EITHER collection keeps the shared number claimed', async () => {
    const tree = makeTree(20);
    undoable(() => tree.$.users.setAll([{ id: 'u1', name: 'a' }]));
    undoable(() => tree.$.orders.setAll([{ id: 'o1', total: 1 }]));
    await tick();
    await tick();

    const shared = subjectOf(tree.$.users, 'u1');
    expect(shared).toBe(subjectOf(tree.$.orders, 'o1'));

    // Retire both. Each collection now holds its own retired subject `shared`.
    undoable(() => tree.$.users.removeOne('u1'));
    await tick();
    await tick();
    undoable(() => tree.$.orders.removeOne('o1'));
    await tick();
    await tick();

    expect(retiredIn(tree.$.users)).toContain(shared);
    expect(retiredIn(tree.$.orders)).toContain(shared);

    const claims = getSubjectRestorationClaims(tree);
    expect(claims?.isClaimed(shared)).toBe(true);
    // Two entries, two collections, ONE number. The registry cannot tell them
    // apart and must not try to.
    expect(claims?.ownersOf(shared).length).toBeGreaterThanOrEqual(2);
  });

  it('evicting one collection restoration history entry does NOT free a number the other still claims', async () => {
    // The ordering the sink would get wrong. `users` churns until its removal
    // entry is evicted; `orders` sits still holding its own claim on the same
    // number.
    const WINDOW = 4;
    const tree = makeTree(WINDOW);
    undoable(() => tree.$.users.setAll([{ id: 'u1', name: 'a' }]));
    undoable(() => tree.$.orders.setAll([{ id: 'o1', total: 1 }]));
    await tick();
    await tick();

    const shared = subjectOf(tree.$.users, 'u1');
    expect(shared).toBe(subjectOf(tree.$.orders, 'o1'));

    undoable(() => tree.$.orders.removeOne('o1'));
    await tick();
    await tick();
    const claims = getSubjectRestorationClaims(tree);
    const ordersOwners = new Set(claims?.ownersOf(shared) ?? []);
    expect(ordersOwners.size).toBeGreaterThan(0);

    undoable(() => tree.$.users.removeOne('u1'));
    await tick();
    await tick();

    // Now churn `users` past the window so the users removal entry is evicted
    // while the orders one is still inside it... except the window is shared,
    // so this evicts BOTH eventually. What must hold at every step is the only
    // thing that matters: the number is not reported unowned while ANY owner
    // remains.
    for (let i = 0; i < WINDOW * 3; i++) {
      undoable(() => tree.$.users.addOne({ id: `filler-${i}`, name: 'f' }));
      await tick();
      await tick();

      const owners = claims?.ownersOf(shared) ?? [];
      expect(claims?.isClaimed(shared)).toBe(owners.length > 0);
    }
  });

  it('when the number goes unowned the BROADCAST reclaims it in BOTH collections', async () => {
    // The property that proves the sink broadcasts rather than routes. One
    // number, two physical owners: a `Map<subjectId, PhysicalOwner>` would pick
    // one and leave the other retained forever. Before the sink existed this
    // test asserted the opposite — that both were still held — which was the
    // measurement that established the requirement.
    const WINDOW = 3;
    const tree = makeTree(WINDOW);
    undoable(() => tree.$.users.setAll([{ id: 'u1', name: 'a' }]));
    undoable(() => tree.$.orders.setAll([{ id: 'o1', total: 1 }]));
    await tick();
    await tick();

    const shared = subjectOf(tree.$.users, 'u1');
    undoable(() => tree.$.users.removeOne('u1'));
    undoable(() => tree.$.orders.removeOne('o1'));
    await tick();
    await tick();

    const claims = getSubjectRestorationClaims(tree);
    for (let i = 0; i < WINDOW * 6 && claims?.isClaimed(shared); i++) {
      undoable(() => tree.$.users.addOne({ id: `filler-${i}`, name: 'f' }));
      await tick();
      await tick();
    }

    expect(claims?.isClaimed(shared)).toBe(false);

    // Both, not one.
    expect(retiredIn(tree.$.users)).not.toContain(shared);
    expect(retiredIn(tree.$.orders)).not.toContain(shared);
  });

  it('a quiet collection is drained once its own claims expire', async () => {
    // The cost of numeric collapsing, measured rather than argued. `orders`
    // retires a handful of subjects and then goes silent; `users` churns
    // forever and keeps re-claiming the same low numbers.
    //
    // Before the sink this asserted that the quiet collection's inventory was
    // over-retained but did not GROW with the neighbour's churn. With the sink
    // the stronger property holds: the neighbour's churn is what evicts the
    // quiet collection's claims, so its inventory drains to nothing.
    const tree = makeTree(6);
    // Designated: the measurement is which restoration CLAIMS this collection
    // holds and when they drain. Undesignated writes hold none, so the claim
    // count would start at zero and the test would prove nothing.
    undoable(() =>
      tree.$.orders.setAll([
        { id: 'o1', total: 1 },
        { id: 'o2', total: 2 },
        { id: 'o3', total: 3 },
      ])
    );
    await tick();
    await tick();
    undoable(() => tree.$.orders.clear());
    await tick();
    await tick();

    const quietAfterRetirement = retiredIn(tree.$.orders).length;
    expect(quietAfterRetirement).toBeGreaterThan(0);

    for (let i = 0; i < 200; i++) {
      // Designated: the neighbour's churn is what EVICTS the quiet collection's
      // claims, which is the mechanism under test. Undesignated churn takes no
      // claims and evicts nothing.
      undoable(() =>
        tree.$.users.setAll([
          { id: `g${i}-a`, name: 'a' },
          { id: `g${i}-b`, name: 'b' },
        ])
      );
      await tick();
      await tick();
    }

    // 400 user subjects retired, and the quiet collection is empty. What must
    // never happen is the reverse — reclaiming while still claimed — which the
    // eviction-ordering test above pins.
    expect(retiredIn(tree.$.orders).length).toBe(0);

    const claims = getSubjectRestorationClaims(tree);
    // And the tree-wide claim inventory still tracks the window, not the churn.
    expect(claims?.snapshot().owners).toBeLessThanOrEqual(6);
  });

  it('SEMANTICS: undo and redo stay correct when both collections share numbers', async () => {
    // The danger numeric collapsing creates that has nothing to do with the
    // sink. `restoreState(state, restorationSubjectIds, positionIds)` puts the
    // numeric set into the write context, so a restore driven by subject NUMBER
    // could act on the wrong collection's subject of the same number. This is
    // the falsifier for that, and it has to run before the sink because a
    // reclamation built on top of a restore that already confuses collections
    // would be reasoning about the wrong thing.
    const tree = makeTree(30);
    tree.$.users.setAll([
      { id: 'u1', name: 'alice' },
      { id: 'u2', name: 'bob' },
    ]);
    tree.$.orders.setAll([
      { id: 'o1', total: 10 },
      { id: 'o2', total: 20 },
    ]);
    await tick();
    await tick();

    expect(subjectOf(tree.$.users, 'u1')).toBe(subjectOf(tree.$.orders, 'o1'));

    undoable(() => tree.$.users.updateOne('u1', { name: 'ALICE' }));
    await tick();
    await tick();
    undoable(() => tree.$.orders.updateOne('o1', { total: 999 }));
    await tick();
    await tick();
    undoable(() => tree.$.users.removeOne('u2'));
    await tick();
    await tick();
    undoable(() => tree.$.orders.removeOne('o2'));
    await tick();
    await tick();

    const read = () => ({
      users: tree.$.users.ids().slice().sort(),
      orders: tree.$.orders.ids().slice().sort(),
      u1: tree.$.users.byId('u1')?.()?.name,
      o1: tree.$.orders.byId('o1')?.()?.total,
    });

    const atEnd = read();
    expect(atEnd).toEqual({
      users: ['u1'],
      orders: ['o1'],
      u1: 'ALICE',
      o1: 999,
    });

    // Walk all the way back. Every step must move exactly one collection; a
    // number-confused restore shows up as the neighbour changing too.
    tree.undo();
    await tick();
    expect(read()).toEqual({
      users: ['u1'],
      orders: ['o1', 'o2'],
      u1: 'ALICE',
      o1: 999,
    });

    tree.undo();
    await tick();
    expect(read()).toEqual({
      users: ['u1', 'u2'],
      orders: ['o1', 'o2'],
      u1: 'ALICE',
      o1: 999,
    });

    tree.undo();
    await tick();
    expect(read()).toEqual({
      users: ['u1', 'u2'],
      orders: ['o1', 'o2'],
      u1: 'ALICE',
      o1: 10,
    });

    tree.undo();
    await tick();
    expect(read()).toEqual({
      users: ['u1', 'u2'],
      orders: ['o1', 'o2'],
      u1: 'alice',
      o1: 10,
    });

    // And forward again to the end.
    tree.redo();
    tree.redo();
    tree.redo();
    tree.redo();
    await tick();
    expect(read()).toEqual(atEnd);
  });

  it('holds the Phase 5 invariant with two collections in the same window', async () => {
    const tree = makeTree(5);
    for (let g = 0; g < 30; g++) {
      undoable(() => tree.$.users.setAll([{ id: `u${g}`, name: 'a' }]));
      await tick();
      await tick();
      undoable(() => tree.$.orders.setAll([{ id: `o${g}`, total: g }]));
      await tick();
      await tick();

      const claims = getSubjectRestorationClaims(tree);
      const history = tree.getRestorationHistory() as Array<{
        restorationSubjectIds?: number[];
      }>;
      const expected = [
        ...new Set(
          history.flatMap((entry) => entry.restorationSubjectIds ?? [])
        ),
      ].sort((a, b) => a - b);
      expect(
        [...(claims?.claimedSubjects() ?? [])].sort((a, b) => a - b)
      ).toEqual(expected);
    }
  });
});
