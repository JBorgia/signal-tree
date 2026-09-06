import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getPositionRegistry } from './internals/position-registry';
import { getTreeRealizationDescriptors } from './internals/causal-runtime/tree-realization-adapter';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * REALIZATION-NAMESPACE-0 — explaining the second axis BEFORE fixing anything.
 *
 * ```text
 * NULL       tree-realization descriptor/capture state is fully owner-isolated;
 *            a second tree whose local position ids collide cannot alter the
 *            realization information tree A uses to roll back
 * FALSIFIER  creating or mutating tree B changes state later used by tree A
 *            because something is keyed by local PositionId without ownership
 * ```
 *
 * ## RESULT — the NULL SURVIVES, and the two axes are ONE DEFECT
 *
 * A's descriptor map is private (`mapSize` 1, distinct map objects, distinct
 * registries), and B never writes into it. What B changes is WHICH OF A'S OWN
 * notifications writes A's descriptor last.
 *
 * ## The discriminator matrix
 *
 * ```text
 * A  A only                              ok
 * B  A + B created, B never mutated      ok      existence alone is fine
 * C  A + B, B SCALAR mutation only       ok      any B notification is fine
 * D  A + B, B COLLECTION mutation        FAILS   the reproducer
 * E  same path, DIFFERENT local posIds   ok      padding A fixes it
 * F  DIFFERENT path, same local posIds   FAILS   path is irrelevant
 * G  B created FIRST                     FAILS   ordering is irrelevant
 * ```
 *
 * ## The descriptor snapshot — it diverges AT THE SEED, before any transaction
 *
 * ```text
 * ONE tree   afterSeed  collectionPath = "data.rows"   ✓
 * TWO trees  afterSeed  collectionPath = "data"        ✗
 * ```
 *
 * Both runs: `ownerPath` correct, map private, same position 4. Only the
 * DERIVED `collectionPath` differs, and it is wrong before a transaction exists.
 *
 * ## Why a second tree changes it — and what it corrects
 *
 * `deriveCollectionPath` takes the STRUCTURAL branch (returning `ownerPath`,
 * correct) only when the notification carries a `structuralEffect`. The
 * unqualified OWNER-ONLY COLLECTION PING — `{ path: 'data.rows' }`, both values
 * undefined, no `structuralEffect`, and no `ownerId` — takes the non-structural
 * branch:
 *
 * ```text
 * if (path === ownerPath) {
 *   return ownerPath.includes('.') ? parentPath(ownerPath) : undefined;
 * }
 * ```
 *
 * `path === ownerPath === "data.rows"` -> `parentPath` -> `"data"`. At TOP level
 * `"rows"` has no dot, so it returns `undefined` and leaves the good value
 * alone — which is the entire reason top-level survives.
 *
 * With one tree that ping coalesces away in the same flush as the structural
 * event. With a second tree mutating a collection at the SAME LOCAL POSITION
 * ID, flush composition changes, the ping survives separately, and it lands
 * LAST — overwriting the correct `collectionPath`.
 *
 * ⚠️ **THIS CORRECTS DEMARCATION-0 AND OWNER-REPLAY-2.** I recorded the
 * owner-only ping as "harmless residue" and "defensive, not load-bearing",
 * because a link filters it out and every transition also emits a qualified
 * event. That was true FOR LINK and false in general: the ping is the vehicle
 * that corrupts realization state here. "Harmless to the consumer I was looking
 * at" is not "harmless".
 *
 * ## So: ONE defect, not two
 *
 * ```text
 * ROOT CAUSE   `deriveCollectionPath` is string-shaped and ambiguous
 * AXIS 1       nested subject-creating ops fail deterministically
 * AXIS 2       a second same-position tree makes even nested removeOne fail,
 *              by changing which notification writes last
 * ```
 *
 * The `path === ownerPath` case cannot mean "a row inside a collection" — if the
 * notification's path IS its owner path, it is ABOUT the owner. Returning
 * `parentPath` there is wrong for any nested owner, and accidentally harmless at
 * the root only because a root path has no dot.
 *
 * Recorded before patching. The fix must key on whether the position IS a
 * collection rather than on string shape, and must not weaken `validateEffects`.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r) => r.id });

type Rows = {
  addOne(r: Row): void;
  removeOne(id: string): void;
  all(): Row[];
};
type Tree = {
  $: { data: Record<string, Rows>; scalar(value: number): void };
  transaction: (fn: () => void) => { rollback(): void };
};

const nested = () =>
  signalTree(
    { data: { rows: em() }, scalar: 0 },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as Tree;
/** Same collection path, PADDED so local position ids differ. */
const nestedPadded = () =>
  signalTree(
    { pad1: 0, pad2: 0, pad3: 0, data: { rows: em() }, scalar: 0 },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as Tree;
/** Same local position ids, DIFFERENT collection path. */
const nestedOtherPath = () =>
  signalTree(
    { data: { others: em() }, scalar: 0 },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as Tree;

const rowsOf = (t: Tree, key = 'rows') => t.$.data[key];

const seedRemoveRollback = async (a: Tree, key = 'rows') => {
  rowsOf(a, key).addOne({ id: 'a-seed', n: 1 });
  await flush();
  const p = a.transaction(() => {
    rowsOf(a, key).removeOne('a-seed');
  });
  await flush();
  let threw = false;
  try {
    p.rollback();
  } catch {
    threw = true;
  }
  await flush();
  return { threw, len: rowsOf(a, key).all().length };
};

describe('REALIZATION-NAMESPACE-0: the discriminator matrix', () => {
  it('A — one tree rolls back', async () => {
    const a = nested();
    await flush();
    expect(await seedRemoveRollback(a)).toEqual({ threw: false, len: 1 });
  });

  it('B — a second tree that is never mutated is harmless', async () => {
    const a = nested();
    nested();
    await flush();
    expect(await seedRemoveRollback(a)).toEqual({ threw: false, len: 1 });
  });

  it('C — a second tree with only a SCALAR mutation is harmless', async () => {
    const a = nested();
    const b = nested();
    await flush();
    b.$.scalar(7);
    await flush();
    expect(await seedRemoveRollback(a)).toEqual({ threw: false, len: 1 });
  });

  it('D — a second tree with a COLLECTION mutation no longer breaks A', async () => {
    const a = nested();
    const b = nested();
    await flush();
    rowsOf(b).addOne({ id: 'b-only', n: 1 });
    await flush();
    const r = await seedRemoveRollback(a);

    // ⚠️ WAS `{ threw: true, len: 0 }` — the refusal, and the speculative
    // DELETION left materialised. Fixed by STRUCTURAL-PATH-1.
    expect(r).toEqual({ threw: false, len: 1 });
  });

  it('E — padding A so local position ids DIFFER makes it work again', async () => {
    const a = nestedPadded();
    const b = nested();
    await flush();
    rowsOf(b).addOne({ id: 'b-only', n: 1 });
    await flush();

    // The trigger is a POSITION ID COLLISION, not co-existence.
    expect(await seedRemoveRollback(a)).toEqual({ threw: false, len: 1 });
  });

  it('F — a DIFFERENT path with the same local ids is fine', async () => {
    const a = nested();
    const b = nestedOtherPath();
    await flush();
    rowsOf(b, 'others').addOne({ id: 'b-only', n: 1 });
    await flush();

    // Pre-fix this failed, which is how the trigger was identified as a local
    // position-id collision rather than a path collision.
    expect(await seedRemoveRollback(a)).toEqual({ threw: false, len: 1 });
  });

  it('G — creation order is irrelevant', async () => {
    const b = nested();
    const a = nested();
    await flush();
    rowsOf(b).addOne({ id: 'b-only', n: 1 });
    await flush();
    expect(await seedRemoveRollback(a)).toEqual({ threw: false, len: 1 });
  });
});

describe('REALIZATION-NAMESPACE-0: descriptor state is OWNER-ISOLATED', () => {
  const descriptorOf = (t: Tree) => {
    const pos = getOwnedPositionIds(rowsOf(t))?.[0];
    const map = getTreeRealizationDescriptors(t.$ as unknown as object);
    const d =
      pos !== undefined
        ? (map?.get(pos as never) as
            | { ownerPath?: string; collectionPath?: string }
            | undefined)
        : undefined;
    return {
      pos,
      mapSize: map?.size,
      ownerPath: d?.ownerPath,
      collectionPath: d?.collectionPath,
    };
  };

  it('the maps and registries are distinct per tree', async () => {
    const a = nested();
    const b = nested();
    await flush();

    expect(getTreeRealizationDescriptors(a.$ as unknown as object)).not.toBe(
      getTreeRealizationDescriptors(b.$ as unknown as object)
    );
    expect(getPositionRegistry(a.$)).not.toBe(getPositionRegistry(b.$));
    // The collision the whole investigation turns on: same LOCAL position id.
    expect(getOwnedPositionIds(rowsOf(a))).toEqual(getOwnedPositionIds(rowsOf(b)));
  });

  it('B never WRITES A descriptor, and no longer changes A\'s derived address', async () => {
    const withB = async (second: boolean) => {
      const a = nested();
      if (second) {
        const b = nested();
        await flush();
        rowsOf(b).addOne({ id: 'b-only', n: 1 });
        await flush();
      }
      await flush();
      rowsOf(a).addOne({ id: 'a-seed', n: 1 });
      await flush();
      return descriptorOf(a);
    };

    const one = await withB(false);
    const two = await withB(true);

    // Private map, correct ownerPath, same position — in BOTH runs.
    expect(one.mapSize).toBe(1);
    expect(two.mapSize).toBe(1);
    expect(one.ownerPath).toBe('data.rows');
    expect(two.ownerPath).toBe('data.rows');
    expect(one.pos).toBe(two.pos);

    // ⚠️ PRE-FIX these diverged — `'data.rows'` with one tree and `'data'` with
    // two, before any transaction ran. That divergence WAS the second axis:
    // not contamination, but a value-less ping winning the FIRST write
    // (descriptors are first-write-wins) and permanently claiming the parent
    // branch as the collection address.
    //
    // STRUCTURAL-PATH-1 stops a notification about the owner from claiming any
    // collection path, so both runs now agree.
    expect(one.collectionPath).toBe('data.rows');
    expect(two.collectionPath).toBe('data.rows');
  });
});
