import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import {
  getOwnedOwnerPath,
  getOwnedPositionIds,
  getOwnedSubjectIds,
} from './internals/owned-metadata';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * REALIZATION-TARGET-ROLE-1 — closing the six regressions, and correcting TWO
 * wrong models in a row (one mine, one from the review).
 *
 * ## The corrections, in order
 *
 * ```text
 * 1  "ownerPath sometimes names a ROW"        proposed, then withdrawn as
 *                                             row-owned POSITIONS
 * 2  "the adapter tests are scalar leaves"    MINE, and WRONG — generalised
 *                                             from `profile.name` / `preference`
 * 3  the measured truth                       below
 * ```
 *
 * ## What is actually true
 *
 * ```text
 * collection node        positionId YES
 * row NODE               positionId NO, no owned metadata at all
 * row FIELD LEAF         positionId YES — and it is THE COLLECTION'S position,
 *                        plus a subjectId, with ownerPath naming the ROW
 * ```
 *
 * Measured on `data.users` containing row `u1`:
 *
 * ```text
 * collPos            = 3
 * nameLeafPos        = 3               <- the collection's position
 * nameLeafOwnerPath  = data.users.u1   <- the ROW path
 * nameLeafSubjects   = [1]
 * ```
 *
 * So `ownerPath` genuinely takes both shapes, and they are indistinguishable as
 * strings — but `effect.owner` is the COLLECTION POSITION in both.
 *
 * ## Which half caused the six regressions — isolated
 *
 * The withdrawn patch had two independent halves. Applied separately:
 *
 * ```text
 * A  `path === ownerPath` -> undefined        breaks NOTHING (152 pass)
 * B  row-field branch -> `ownerPath`          breaks ALL SIX
 * ```
 *
 * ⚠️ So candidate A is safe, and the `preference` case — flagged as unexplained
 * — is simply not affected by it: `'preference'` has no dot, so the old code
 * already returned `undefined` there. Nothing to explain; the test never
 * depended on that branch.
 *
 * B broke them because I returned `ownerPath` — which is the COLLECTION in
 * production and the ROW in those tests. The old `parentPath(ownerPath)` is
 * right for the row shape and wrong for the collection shape; my rule was the
 * exact inverse. Both rules are shape-dependent, which is the original finding.
 *
 * ## The rule that is correct for BOTH
 *
 * ```text
 *                 ownerPath        old parentPath   candidate B   REGISTRY RULE
 * production      data.rows        data        ✗    data.rows ✓   data.rows  ✓
 * adapter tests   data.users.u1    data.users  ✓    data.users.u1 ✗ data.users ✓
 * ```
 *
 * > **Ask the registry for the owner position's canonical collection address.
 * > Never read `ownerPath`'s shape.** It is correct for both because it ignores
 * > the string entirely.
 *
 * That is exactly the PositionRegistry-as-authority decision, and this file is
 * the measurement that earns it rather than assuming it.
 *
 * ## The separation that makes it simple
 *
 * ```text
 * PositionId  = the CAUSAL / OWNERSHIP position
 * SubjectId   = an ENTITY LIFETIME
 * field path  = a coordinate WITHIN the current subject
 * ```
 *
 * ⚠️ "PositionIds identify STATE positions" was TOO STRONG, and this file's own
 * measurement is why: a row field leaf reports the COLLECTION's P3, so a
 * PositionId does not uniquely identify that leaf — it identifies who OWNS it.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type User = { id: string; name: string };

const makeTree = () =>
  signalTree(
    {
      data: {
        users: entityMap<User, string>({ selectId: (u) => u.id }),
        count: 0,
      },
    },
    { enhancers: [restoration(), transactions()] }
  );

describe('REALIZATION-TARGET-ROLE-1: what carries a position', () => {
  it('⚠️ a row NODE has no owned metadata; its FIELD LEAF carries the COLLECTION position', async () => {
    const tree = makeTree();
    await flush();
    undoable(() => tree.$.data.users.addOne({ id: 'u1', name: 'Alice' }));
    await flush();

    const collPos = getOwnedPositionIds(tree.$.data.users)?.[0];
    const rowNode = tree.$.data.users.byIdOrFail('u1');
    const nameLeaf = (rowNode as { name: unknown }).name;

    // The row itself is not a position — it is a SUBJECT.
    expect(getOwnedPositionIds(rowNode)).toBeUndefined();

    // Its field leaf IS addressed, and by the collection's position.
    expect(getOwnedPositionIds(nameLeaf)?.[0]).toBe(collPos);
    expect(getOwnedSubjectIds(nameLeaf)).toEqual([1]);

    // ⚠️ AND ITS ownerPath NAMES THE ROW — the shape that makes any string rule
    // ambiguous, since the collection's own notifications use `data.users`.
    expect(getOwnedOwnerPath(nameLeaf)).toBe('data.users.u1');
    expect(getOwnedOwnerPath(tree.$.data.users)).toBe('data.users');
  });

  it('so ONE position answers to two ownerPath shapes', async () => {
    const tree = makeTree();
    await flush();
    undoable(() => tree.$.data.users.addOne({ id: 'u1', name: 'Alice' }));
    await flush();

    const collPos = getOwnedPositionIds(tree.$.data.users)?.[0] as number;
    const nameLeaf = (tree.$.data.users.byIdOrFail('u1') as { name: unknown })
      .name;

    const shapes = [
      getOwnedOwnerPath(tree.$.data.users), // 'data.users'   — collection
      getOwnedOwnerPath(nameLeaf), // 'data.users.u1' — row
    ];

    // Two different strings, one position. No string test can recover the role;
    // the position already knows it.
    expect(new Set(shapes).size).toBe(2);
    expect(getOwnedPositionIds(nameLeaf)?.[0]).toBe(collPos);
  });
});

describe('REALIZATION-TARGET-ROLE-1: the registry rule is correct for both shapes', () => {
  /**
   * The candidate rule, evaluated here against BOTH observed `ownerPath` shapes
   * for the same owner position. This is a decision-table proof, not an
   * implementation: nothing in production consults it yet.
   */
  const registryRule = (
    canonicalCollectionAddress: string,
    _ownerPath: string
  ) => canonicalCollectionAddress;

  const parentPath = (p: string) => {
    const i = p.lastIndexOf('.');
    return i === -1 ? '' : p.slice(0, i);
  };

  it('⚠️ the two string rules are exact inverses; the registry rule beats both', async () => {
    const tree = makeTree();
    await flush();
    undoable(() => tree.$.data.users.addOne({ id: 'u1', name: 'Alice' }));
    await flush();

    const canonical = getOwnedOwnerPath(tree.$.data.users) as string;
    const collectionShape = canonical; // 'data.users'
    const rowShape = getOwnedOwnerPath(
      (tree.$.data.users.byIdOrFail('u1') as { name: unknown }).name
    ) as string; // 'data.users.u1'

    // OLD rule: right for the row shape, wrong for the collection shape.
    expect(parentPath(rowShape)).toBe(canonical);
    expect(parentPath(collectionShape)).not.toBe(canonical);

    // CANDIDATE B: the exact inverse.
    expect(collectionShape).toBe(canonical);
    expect(rowShape).not.toBe(canonical);

    // REGISTRY RULE: correct for both, because it never reads the string.
    expect(registryRule(canonical, collectionShape)).toBe(canonical);
    expect(registryRule(canonical, rowShape)).toBe(canonical);
  });

  it('the collection position is identifiable, and a plain leaf is not', async () => {
    const tree = makeTree();
    await flush();

    const collPos = getOwnedPositionIds(tree.$.data.users)?.[0];
    const scalarPos = getOwnedPositionIds(tree.$.data.count)?.[0];
    const registry = getPositionRegistry(tree.$);

    // Both are positions in the same registry...
    expect(registry).toBeDefined();
    expect(collPos).toBeDefined();
    expect(scalarPos).toBeDefined();
    expect(collPos).not.toBe(scalarPos);

    // ...and the ordinary scalar's ownerPath ALSO contains a dot, so the
    // discriminator cannot be shape-based — it must be a recorded fact.
    expect(getOwnedOwnerPath(tree.$.data.count)).toBe('data.count');
    expect(getOwnedOwnerPath(tree.$.data.users)).toBe('data.users');
  });
});
