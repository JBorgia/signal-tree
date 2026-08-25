import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import {
  getOwnedOwnerPath,
  getOwnedPositionIds,
} from './internals/owned-metadata';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { visitTree } from './internals/visit-tree';

/**
 * REALIZATION-ADDRESS-0 — the INVENTORY, before any production edit.
 *
 * The remaining defect is renamed for what it actually is:
 *
 * > **REALIZATION ADDRESS ROLE AMBIGUITY.** `ownerPath` is not one semantic
 * > thing. Sometimes it names a COLLECTION (`data.rows`); sometimes it
 * > legitimately names a ROW (`rows.someKey`). The adapter and rekey controls
 * > prove both are valid, so no string test can separate them.
 *
 * ```text
 * INVALID DISCRIMINATORS
 *   ownerPath.includes('.')
 *   path === ownerPath
 *   parentPath(ownerPath) chosen by shape
 * ```
 *
 * Dots encode NESTING, not semantic role. That is why my first candidate fix
 * broke five adapter tests and a restoration rekey test: it changed the rule for
 * BOTH roles at once.
 *
 * ```text
 * NULL       the owning POSITION identity contains enough information to
 *            distinguish collection-owned from row-owned effects, and to derive
 *            collection + field addresses without inspecting path shape
 * FALSIFIER  two valid cases share an owner-position classification but need
 *            contradictory interpretation
 * ```
 *
 * ## THE MEASURED INVENTORY — the NULL survives for every collection case
 *
 * Instrumenting `rememberTreeRealizationDescriptor` and classifying
 * `effect.owner` against the set of positions that ARE collections:
 *
 * ```text
 *                                                          derived
 * shape   op          owner  ROLE        path              collectionPath
 * TOP     addOne        2    COLLECTION  rows.x            rows        ✓
 * TOP     addOne        2    COLLECTION  rows              undefined   ok
 * TOP     addMany       2    COLLECTION  rows.x            rows        ✓
 * TOP     updateOne     2    COLLECTION  rows.seed         rows        ✓
 * TOP     upsertOne     2    COLLECTION  rows.seed         rows        ✓
 * TOP     removeOne     2    COLLECTION  rows.seed         rows        ✓
 * NESTED  addOne        3    COLLECTION  data.rows.x       data.rows   ✓
 * NESTED  addOne        3    COLLECTION  data.rows         data        ✗
 * NESTED  addMany       3    COLLECTION  data.rows.x       data.rows   ✓
 * NESTED  addMany       3    COLLECTION  data.rows         data        ✗
 * NESTED  updateOne     3    COLLECTION  data.rows.seed    data        ✗
 * NESTED  upsertOne     3    COLLECTION  data.rows.seed    data        ✗
 * NESTED  removeOne     3    COLLECTION  data.rows.seed    data.rows   ✓
 * NESTED  removeOne     3    COLLECTION  data.rows         data        ✗
 * ```
 *
 * ⚠️ **`ROLE` is `COLLECTION` in every single row.** The position-based
 * discriminator identifies it correctly every time, for both depths and every
 * operation — while the string derivation is wrong for every NESTED
 * non-structural notification.
 *
 * So the answers to the preregistered questions, for the collection battery:
 *
 * ```text
 * 1  roles ownerPath can have      COLLECTION and ROW — both legitimate
 * 2  can owner position tell them apart?   YES, measured, with no exceptions
 * 3  what the adapter tests protect         the ROW-OWNED reading — which is
 *                                           why a blanket change broke them
 * 4  canonical containing collection        the owner position's own address,
 *                                           when that position IS a collection
 * 5  canonical field within a subject       the path relative to the collection,
 *                                           minus the subject-key segment
 * ```
 *
 * ## The rule the inventory supports
 *
 * ```text
 * if effect.owner IS a collection position
 *      collectionPath   = that collection's address        (no dot counting)
 *      fieldPathFromRow = relative path minus the subject-key segment
 * else
 *      the existing ROW-OWNED rules, UNCHANGED
 * ```
 *
 * Role-conditional, so the adapter and rekey tests are preserved BY
 * CONSTRUCTION rather than by luck — they are row-owned and take the other
 * branch untouched.
 *
 * ## ⚠️ WHY IT IS NOT IMPLEMENTED HERE — a plumbing constraint, measured
 *
 * `structuralOwnerPaths` (PositionId -> collection address) is built in
 * `createTreeRealizationAdapter`'s closure. `rememberTreeRealizationDescriptor`
 * is a FREE FUNCTION called from `transactions` and `restoration`, and it has no
 * access to it. So the role classification the fix needs is not reachable from
 * where the derivation happens.
 *
 * That is a real design decision — where the collection-position index should
 * live, and whether the derived strings should remain descriptor state at all —
 * and questions 6 and 7 are still open:
 *
 * ```text
 * 6  can collectionPath / fieldPathFromRow stay DERIVED CACHES safely, or
 *    should one stop being descriptor authority?
 * 7  does any fix preserve the ZERO-TREE-VISIT property the adapter tests
 *    protect?
 * ```
 *
 * ⚠️ Descriptors are FIRST-WRITE-WINS
 * (`existing?.collectionPath ?? collectionPath`), so a weaker notification that
 * arrives first permanently claims a derived interpretation. OWNER-PING-0 fixed
 * the CROSS-TREE ordering that exposed this; it did not make caching an
 * ambiguous derivation safe.
 *
 * Reported rather than implemented, per the success criteria.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r) => r.id });

const isCollectionNode = (n: unknown) =>
  (typeof n === 'object' || typeof n === 'function') && n !== null
    ? typeof (n as { addOne?: unknown }).addOne === 'function'
    : false;

/** The SEMANTIC fact: which positions in this tree are collections. */
const collectionPositions = (root: unknown) => {
  const out = new Map<number, string>();
  visitTree(
    root,
    (node) => {
      if (!isCollectionNode(node)) return undefined;
      const pos = getOwnedPositionIds(node)?.[0];
      const op = getOwnedOwnerPath(node);
      if (pos !== undefined && op !== undefined) out.set(pos, op);
      return undefined;
    },
    { skipKey: (k) => k === 'set' || k === 'update' || k.startsWith('_') }
  );
  return out;
};

describe('REALIZATION-ADDRESS-0: the position-role discriminator', () => {
  it('⚠️ a collection position is identifiable at EVERY depth, without path shape', async () => {
    const shapes: Array<[string, () => unknown, (t: unknown) => unknown]> = [
      [
        'top',
        () => signalTree({ rows: em() }, { enhancers: [restoration(), transactions()] }),
        (t) => (t as { $: { rows: unknown } }).$.rows,
      ],
      [
        'depth 1',
        () =>
          signalTree(
            { data: { rows: em() } },
            { enhancers: [restoration(), transactions()] }
          ),
        (t) => (t as { $: { data: { rows: unknown } } }).$.data.rows,
      ],
      [
        'depth 3',
        () =>
          signalTree(
            { a: { b: { c: { rows: em() } } } },
            { enhancers: [restoration(), transactions()] }
          ),
        (t) =>
          (t as { $: { a: { b: { c: { rows: unknown } } } } }).$.a.b.c.rows,
      ],
    ];

    for (const [label, make, get] of shapes) {
      const tree = make();
      await flush();
      const rows = get(tree);
      const pos = getOwnedPositionIds(rows)?.[0];
      const address = getOwnedOwnerPath(rows);
      const index = collectionPositions((tree as { $: unknown }).$);

      expect(pos, `${label}: no position`).toBeDefined();
      // The position-based classification is exact — no dot counting anywhere.
      expect(index.has(pos as number), `${label}: not classified`).toBe(true);
      expect(index.get(pos as number)).toBe(address);
    }
  });

  it('a plain nested LEAF is NOT classified as a collection', async () => {
    const tree = signalTree(
      { data: { rows: em(), count: 0 } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    const index = collectionPositions(tree.$);
    const leafPos = getOwnedPositionIds(tree.$.data.count)?.[0];

    // The control: the discriminator must reject as well as accept, or
    // "everything is a collection" would satisfy the case above.
    expect(leafPos).toBeDefined();
    expect(index.has(leafPos as number)).toBe(false);
    // And its owner path has a dot, so a shape-based test could not tell them
    // apart — which is the entire point.
    expect(getOwnedOwnerPath(tree.$.data.count)).toBe('data.count');
  });

  it('the classification survives a rekey — it is position-stable, not key-stable', async () => {
    const tree = signalTree(
      { data: { rows: em() } },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    tree.$.data.rows.addOne({ id: 'before', n: 1 });
    await flush();
    const posBefore = getOwnedPositionIds(tree.$.data.rows)?.[0];

    tree.$.data.rows.changeId('before', 'after');
    await flush();

    const index = collectionPositions(tree.$);
    const posAfter = getOwnedPositionIds(tree.$.data.rows)?.[0];

    // Field addressing must be subject-stable and must not depend on the
    // original entity key remaining current.
    expect(posAfter).toBe(posBefore);
    expect(index.get(posAfter as number)).toBe('data.rows');
    expect(tree.$.data.rows.ids()).toEqual(['after']);
  });
});
