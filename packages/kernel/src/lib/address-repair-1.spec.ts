import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getPositionRegistry } from './internals/position-registry';
import {
  rememberTreeRealizationDescriptor,
  type TreeRealizationDescriptor,
} from './internals/causal-runtime/tree-realization-adapter';
import type { PositionId } from './types';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * ADDRESS-REPAIR-1 — the production correction, and its permanent battery.
 *
 * > **Ask the registry for the owner position's canonical collection address.
 * > Never read `ownerPath`'s shape.**
 *
 * The collection PositionId and its address are BOTH known at entityMap
 * materialization, so they are recorded there. Everything downstream asks
 * instead of guessing:
 *
 * ```text
 * path === collection        owner-only notification  -> NO address
 * collection + 1 segment     the row itself           -> whole
 * collection + 2+ segments   a field within the row   -> field(rest)
 * ```
 *
 * ## What it closed
 *
 * ```text
 * nested addOne / addMany / updateOne / upsertOne   were KNOWN RED
 * nested collection rollback (LINK-COLLECTION-0)    was KNOWN RED
 * SUBJECT-ADDRESS-0 nested round-trip               was KNOWN RED
 * ```
 *
 * ⚠️ **`REPLACE-ONE-SUBJECT-0` deliberately still fails.** It is a CONTROL for
 * this commit: that defect drops `SubjectId` at the mutation producer, upstream
 * of address derivation entirely, so a correct address repair must NOT fix it.
 * If it had, the repair would have been doing something other than what it
 * claims.
 *
 * ## Why the string rules could not be patched
 *
 * REALIZATION-TARGET-ROLE-1 measured one owner position answering to two
 * legitimate `ownerPath` shapes:
 *
 * ```text
 *                 ownerPath        old parentPath   candidate B    REGISTRY
 * production      data.rows        data        ✗    data.rows ✓    data.rows ✓
 * adapter tests   data.users.u1    data.users  ✓    data.users.u1 ✗ data.users ✓
 * ```
 *
 * The two string rules are exact inverses. The registry rule is correct for both
 * because it never reads the string.
 *
 * ⚠️ Synthetic callers with no registered collection keep the legacy
 * interpretation BY CONSTRUCTION — they never materialized an entityMap, so
 * `collectionPathFor` returns `undefined` and the legacy branch runs. The
 * adapter and rekey batteries are preserved by that, not by a special case.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; name: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r: Row) => r.id });

type Rows = {
  addOne(r: Row): void;
  updateOne(id: string, patch: Partial<Row>): void;
  removeOne(id: string): void;
  changeId(from: string, to: string): void;
  byIdOrFail(id: string): {
    name: { (value: string): void; (update: (current: string) => string): void; (): string };
    n: { (value: number): void; (update: (current: number) => number): void; (): number };
  };
  ids(): string[];
  all(): Row[];
};

type Deep = {
  $: { a: { b: { c: { rows: Rows } } } };
  transaction: (fn: () => void) => { rollback(): void; confirm(): void };
};

const nestedTree = () =>
  signalTree(
    { data: { rows: em() }, other: 0 },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as {
    $: {
      data: { rows: Rows };
      other: { (value: number): void; (update: (current: number) => number): void; (): number };
    };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
    undo?: () => void;
  };

const deepTree = () =>
  signalTree(
    { a: { b: { c: { rows: em() } } } },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as Deep;

const seededNested = async () => {
  const tree = nestedTree();
  await flush();
  tree.$.data.rows.addOne({ id: 'r1', name: 'orig', n: 1 });
  await flush();
  return tree;
};

describe('ADDRESS-REPAIR-1: the registry is the collection authority', () => {
  it('a collection position resolves to its canonical address at any depth', async () => {
    const nested = nestedTree();
    const deep = deepTree();
    await flush();

    const nReg = getPositionRegistry(nested.$);
    const nPos = getOwnedPositionIds(nested.$.data.rows)?.[0];
    expect(nReg?.collectionPathFor(nPos as never)).toBe('data.rows');

    const dReg = getPositionRegistry(deep.$);
    const dPos = getOwnedPositionIds(deep.$.a.b.c.rows)?.[0];
    expect(dReg?.collectionPathFor(dPos as never)).toBe('a.b.c.rows');
  });

  it('⚠️ an ordinary nested scalar is REJECTED, though its path has a dot', async () => {
    const tree = nestedTree();
    await flush();

    // The control. Without it, "every position is a collection" would satisfy
    // the case above, and a dot-counting rule would be indistinguishable.
    const reg = getPositionRegistry(tree.$);
    const scalarPos = getOwnedPositionIds(tree.$.other)?.[0];
    expect(scalarPos).toBeDefined();
    expect(reg?.collectionPathFor(scalarPos as never)).toBeUndefined();
  });

  it('the mapping is position-stable across a rekey', async () => {
    const tree = await seededNested();
    const reg = getPositionRegistry(tree.$);
    const pos = getOwnedPositionIds(tree.$.data.rows)?.[0];

    tree.$.data.rows.changeId('r1', 'r9');
    await flush();

    expect(getOwnedPositionIds(tree.$.data.rows)?.[0]).toBe(pos);
    expect(reg?.collectionPathFor(pos as never)).toBe('data.rows');
  });
});

describe('ADDRESS-REPAIR-1: nested rollback batteries', () => {
  it('two fields on one nested subject both roll back', async () => {
    const tree = await seededNested();

    const p = tree.transaction(() => {
      tree.$.data.rows.byIdOrFail('r1').name('changed');
      tree.$.data.rows.byIdOrFail('r1').n(99);
    });
    await flush();
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(99);

    p.rollback();
    await flush();

    expect(tree.$.data.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('field -> rekey -> field rolls back as one nested frame', async () => {
    const tree = await seededNested();

    const p = tree.transaction(() => {
      tree.$.data.rows.byIdOrFail('r1').name('changed');
      tree.$.data.rows.changeId('r1', 'r9');
      tree.$.data.rows.byIdOrFail('r9').n(99);
    });
    await flush();
    expect(tree.$.data.rows.ids()).toEqual(['r9']);

    p.rollback();
    await flush();

    // SubjectId resolved the CURRENT key at every step; no original-key
    // dependency survived the rekey.
    expect(tree.$.data.rows.ids()).toEqual(['r1']);
    expect(tree.$.data.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('mixed scalar + structural rolls back atomically', async () => {
    const tree = await seededNested();

    const p = tree.transaction(() => {
      tree.$.other(42);
      tree.$.data.rows.byIdOrFail('r1').n(99);
      tree.$.data.rows.addOne({ id: 'r2', name: 'added', n: 2 });
    });
    await flush();
    expect(tree.$.data.rows.ids()).toEqual(['r1', 'r2']);

    p.rollback();
    await flush();

    expect(tree.$.other()).toBe(0);
    expect(tree.$.data.rows.ids()).toEqual(['r1']);
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('a deeply nested collection rolls back too', async () => {
    const tree = deepTree();
    await flush();
    tree.$.a.b.c.rows.addOne({ id: 'r1', name: 'orig', n: 1 });
    await flush();

    const p = tree.transaction(() => tree.$.a.b.c.rows.updateOne('r1', { n: 99 }));
    await flush();
    p.rollback();
    await flush();

    expect(tree.$.a.b.c.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('undo works on a nested collection as well as transaction rollback', async () => {
    const tree = await seededNested();

    undoable(() => tree.$.data.rows.updateOne('r1', { n: 99 }));
    await flush();
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(99);

    tree.undo?.();
    await flush();

    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(1);
  });
});

describe('ADDRESS-REPAIR-1: the owner ping establishes NO subject address', () => {
  /**
   * The ordering invariant. A collection-owner notification and a field write
   * must produce the same outcome in either order — the ping has no address to
   * contribute, so it cannot claim one first.
   */
  const order = async (pingFirst: boolean) => {
    const tree = await seededNested();
    const rows = tree.$.data.rows;

    const p = tree.transaction(() => {
      if (pingFirst) {
        rows.addOne({ id: 'r2', name: 'ping', n: 2 });
        rows.byIdOrFail('r1').n(99);
      } else {
        rows.byIdOrFail('r1').n(99);
        rows.addOne({ id: 'r2', name: 'ping', n: 2 });
      }
    });
    await flush();
    p.rollback();
    await flush();

    return {
      ids: rows.ids(),
      n: rows.byIdOrFail('r1').n(),
      name: rows.byIdOrFail('r1').name(),
    };
  };

  it('⚠️ ping -> field and field -> ping produce identical state', async () => {
    const forward = await order(true);
    const reverse = await order(false);

    expect(forward).toEqual(reverse);
    expect(forward.ids).toEqual(['r1']);
    expect(forward.n).toBe(1);
    expect(forward.name).toBe('orig');
  });

  it('a structural-only frame rolls back with no scalar address involved', async () => {
    const tree = await seededNested();

    const p = tree.transaction(() => {
      tree.$.data.rows.addOne({ id: 'r2', name: 'x', n: 2 });
      tree.$.data.rows.removeOne('r1');
    });
    await flush();
    expect(tree.$.data.rows.ids()).toEqual(['r2']);

    p.rollback();
    await flush();

    expect(tree.$.data.rows.ids()).toEqual(['r1']);
    expect(tree.$.data.rows.byIdOrFail('r1').name()).toBe('orig');
  });
});

describe('ADDRESS-REPAIR-1: two same-shaped trees stay isolated', () => {
  it('rolling back tree A leaves tree B untouched', async () => {
    const a = await seededNested();
    const b = await seededNested();
    b.$.data.rows.addOne({ id: 'b-only', name: 'b', n: 7 });
    await flush();

    // Local position ids deliberately collide across registries — that is the
    // falsifier NOTIFIER-OWNERSHIP relies on, and the registry lookup is keyed
    // per registry rather than globally.
    expect(getOwnedPositionIds(a.$.data.rows)).toEqual(
      getOwnedPositionIds(b.$.data.rows)
    );

    const p = a.transaction(() => a.$.data.rows.updateOne('r1', { n: 99 }));
    await flush();
    p.rollback();
    await flush();

    expect(a.$.data.rows.byIdOrFail('r1').n()).toBe(1);
    expect(b.$.data.rows.ids()).toEqual(['r1', 'b-only']);
    expect(b.$.data.rows.byIdOrFail('b-only').n()).toBe(7);
  });
});

/**
 * ⚠️ THE PING CONTRACT IS PINNED AT THE DERIVATION BOUNDARY, AND HERE IS WHY.
 *
 * Mutation B — make the owner-only notification return `whole` instead of no
 * address — killed **ZERO** tests across the entire suite. That is not a gap in
 * coverage to paper over; it is a measured fact about reachability:
 *
 * ```text
 * SUBJECT-ADDRESS-CARDINALITY-0   every real effect carries an inline address
 *                                 and the inline term wins
 * REAL-WHOLE-EFFECT-0             no non-structural effect needs whole; every
 *                                 structural effect skips field derivation
 * ```
 *
 * Together those make the descriptor's subject coordinate UNREACHABLE for real
 * production traffic, so a bogus `''` sitting in it changes no observable
 * behaviour today.
 *
 * So the ping repair is **correctness by construction, not a live bug fix**, and
 * saying otherwise would overstate it. It is still worth having — the fallback
 * becomes reachable the moment any addressless non-structural effect appears,
 * and REPLACE-ONE-SUBJECT-0 is already a defect of exactly that shape — but the
 * honest place to pin it is the derivation contract, not end-to-end behaviour
 * that cannot currently distinguish it.
 */
describe('ADDRESS-REPAIR-1: the ping contract, pinned directly', () => {
  const collectionPositionOf = async () => {
    const tree = nestedTree();
    await flush();
    const registry = getPositionRegistry(tree.$);
    const owner = getOwnedPositionIds(tree.$.data.rows)?.[0] as number;
    return { tree, registry, owner };
  };

  it('⚠️ an owner-only notification establishes NO subject address', async () => {
    const { registry, owner } = await collectionPositionOf();
    const descriptors = new Map<PositionId, TreeRealizationDescriptor>();

    // The ping: path IS the collection's own address.
    rememberTreeRealizationDescriptor({
      descriptors,
      path: 'data.rows',
      ownerPath: 'data.rows',
      positionIds: [owner],
      subjectIds: [1],
      registry,
    });

    // No coordinate, at either level. The old code returned `''` here — and
    // returned it BEFORE examining subjectId at all.
    expect(descriptors.get(owner as PositionId)?.fieldPathFromRow).toBeUndefined();
    expect(
      descriptors
        .get(owner as PositionId)
        ?.subjectDescriptors?.get('1')?.fieldPathFromRow
    ).toBeUndefined();
  });

  it('a row-level notification IS whole; a field notification is the field', async () => {
    const { registry, owner } = await collectionPositionOf();
    const sub = (d: Map<PositionId, TreeRealizationDescriptor>) =>
      d.get(owner as PositionId)?.subjectDescriptors?.get('1')?.fieldPathFromRow;

    const whole = new Map<PositionId, TreeRealizationDescriptor>();
    rememberTreeRealizationDescriptor({
      descriptors: whole,
      path: 'data.rows.r1',
      ownerPath: 'data.rows',
      positionIds: [owner],
      subjectIds: [1],
      registry,
    });

    const field = new Map<PositionId, TreeRealizationDescriptor>();
    rememberTreeRealizationDescriptor({
      descriptors: field,
      path: 'data.rows.r1.name',
      ownerPath: 'data.rows',
      positionIds: [owner],
      subjectIds: [1],
      registry,
    });

    // Three genuinely distinct outcomes from three notification shapes, where
    // the old rule collapsed the first two into `''`.
    expect(sub(whole)).toBe('');
    expect(sub(field)).toBe('name');

    // ⚠️ And the entity key is CONSUMED, never returned as a coordinate — the
    // nested defect produced `FIELD="r1.name"` here.
    expect(sub(field)).not.toContain('r1');
  });

  it('the canonical collection is the registered one, not a parent guess', async () => {
    const { registry, owner } = await collectionPositionOf();
    const descriptors = new Map<PositionId, TreeRealizationDescriptor>();

    rememberTreeRealizationDescriptor({
      descriptors,
      path: 'data.rows.r1.name',
      ownerPath: 'data.rows',
      positionIds: [owner],
      subjectIds: [1],
      registry,
    });

    // The old rule returned `parentPath('data.rows')` = `data`, a branch, which
    // is where nested rollback died.
    expect(
      descriptors.get(owner as PositionId)?.subjectDescriptors?.get('1')
        ?.collectionPath
    ).toBe('data.rows');
  });
});
