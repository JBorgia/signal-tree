import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { signalTree } from './signal-tree';

/**
 * LINK-MATERIALIZED-VALUE-0 — which callable sources have a TRUTHFUL natural
 * value?
 *
 * ```text
 * NULL       callable root/branch natural values already have a public type
 *            that truthfully matches their materialized runtime value; only
 *            EntitySignal needed a special NaturalValue branch
 * FALSIFIER  a callable source containing entityMap state exposes
 *            EntityMapBuilder in its declared value type while the runtime
 *            natural state contains something different
 * ```
 *
 * ## RESULT — FALSIFIED, and ⚠️ IT IS NOT ROOT-SPECIFIC
 *
 * ```text
 * cell       TYPE today                            RUNTIME read
 * A count    number                                1                      ✓
 * B rows     Row[]                                 Row[] via all()        ✓
 * C nested   { label, users: EntityMapBuilder }    { label,
 *                                                    users: { all: User[] } }  ✗
 * D root     ...EntityMapBuilder in 2 positions    ...{ all: [] } in both     ✗
 * E plain    { a: number; b: string }              { a: 1, b: 'two' }     ✓
 * ```
 *
 * ⚠️ **The nested branch has the IDENTICAL defect as the root.** That is the
 * decisive distinction the probe was designed to draw:
 *
 * > The problem is RECURSIVE MATERIALIZATION, not root identity.
 *
 * So a policy phrased as "exclude the root" would be measuring the wrong thing —
 * `tree.$.nested` is equally untruthful, and `tree.$.plain` is fine.
 *
 * ## ⚠️ The type is fiction in a THIRD way — it matches NEITHER side
 *
 * ```text
 * declared   EntityMapBuilder<User, string, ...>    the construction marker
 * read       { all: User[] }
 * write      { all: User[] }  OR  User[]
 * ```
 *
 * The builder is what you PASS IN at construction. It is not what the tree reads
 * back and not what it accepts on write. This is the same category of error as
 * LINK-COLLECTION-TYPE-0's finding, one level higher:
 *
 * > **construction marker type != synchronized runtime state type**
 *
 * ## `{ all: T[] }` is DESIGNED, not an artifact
 *
 * The live collection node has 32 own enumerable keys (`byId`, `addOne`,
 * `setAll`, `ids`, `count`, ...). The snapshot has exactly ONE. So the shape is
 * deliberately selected, and `applyState` confirms it with an explicit branch:
 *
 * ```ts
 * typeof stateNode.setAll === 'function' && Array.isArray(snapshot.all)
 *   -> stateNode.setAll(snapshot.all)
 * ```
 *
 * It is the serialization / devtools / restore representation.
 *
 * ## The round trip IS coherent — so this is not outcome 3
 *
 * Reading a branch and writing it straight back preserves state, because the
 * write side accepts BOTH `{ all: [] }` and a bare array. A full-state contract
 * therefore EXISTS at runtime for root and branches.
 *
 * ⚠️ But read and write are ASYMMETRIC:
 *
 * ```text
 * read  -> { all: T[] }
 * write <- { all: T[] } | T[]
 * ```
 *
 * Link synchronizes complete X with complete Y. An endpoint would RECEIVE
 * `{ users: { all: [...] } }` and be permitted to SEND either shape — and
 * `{ all: [...] }` is an internal snapshot representation, not something a
 * userland endpoint should have to speak.
 *
 * ## Disposition — measured, and it widens the earlier plan
 *
 * ```text
 * TRUTHFUL, admit          owned scalar leaf
 *                          entity collection      (read all() / write setAll())
 *                          ordinary branch with NO collection in its state
 *
 * UNTRUTHFUL, exclude      any callable source whose declared state contains an
 *                          entityMap marker — the root of any tree that has a
 *                          collection, AND any branch containing one
 * ```
 *
 * That rule is exactly expressible in the type system (see the typing spec) and
 * needs no recursive materialization machinery. Recorded, NOT implemented —
 * excluding a target is a public-surface decision.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; n: number };
type User = { id: string; name: string };

const makeTree = () =>
  signalTree({
    count: 1,
    rows: entityMap<Row, string>({ selectId: (r: Row) => r.id }),
    nested: {
      label: 'x',
      users: entityMap<User, string>({ selectId: (u: User) => u.id }),
    },
    plain: { a: 1, b: 'two' },
  }) as unknown as {
    $: {
      (): unknown;
      count: () => number;
      rows: { addOne(r: Row): void; all(): Row[] };
      nested: {
        (value?: unknown): unknown;
        users: { addOne(u: User): void };
      };
      plain: () => unknown;
    };
  };

const seeded = async () => {
  const tree = makeTree();
  await flush();
  tree.$.rows.addOne({ id: 'r1', n: 1 });
  tree.$.nested.users.addOne({ id: 'u1', name: 'Alice' });
  await flush();
  return tree;
};

describe('LINK-MATERIALIZED-VALUE-0: the runtime natural value', () => {
  it('a leaf, a collection and a plain branch are all truthful', async () => {
    const tree = await seeded();

    expect(tree.$.count()).toBe(1);
    expect(tree.$.rows.all()).toEqual([{ id: 'r1', n: 1 }]);
    expect(tree.$.plain()).toEqual({ a: 1, b: 'two' });
  });

  it('⚠️ a branch CONTAINING a collection reads it as `{ all: T[] }`', async () => {
    const tree = await seeded();
    const value = tree.$.nested() as Record<string, unknown>;

    expect(Object.keys(value).sort()).toEqual(['label', 'users']);
    // NOT User[], and NOT the builder the declared type names.
    expect(Object.keys(value['users'] as object)).toEqual(['all']);
    expect((value['users'] as { all: User[] }).all).toEqual([
      { id: 'u1', name: 'Alice' },
    ]);
  });

  it('⚠️ and it is a SNAPSHOT, not the live node', async () => {
    const tree = await seeded();
    const value = tree.$.nested() as Record<string, unknown>;

    // The live node has the full API surface; the snapshot has one key. So the
    // shape is deliberately selected, not a generic copy of enumerable keys.
    const live = tree.$.nested.users as unknown as object;
    expect(value['users']).not.toBe(live);
    expect(Object.keys(live).length).toBeGreaterThan(20);
    expect(Object.keys(live)).toContain('setAll');
  });

  it('the root has the same defect, in every collection position', async () => {
    const tree = await seeded();
    const value = tree.$() as Record<string, unknown>;

    expect(Object.keys(value['rows'] as object)).toEqual(['all']);
    expect(
      Object.keys(
        (value['nested'] as Record<string, unknown>)['users'] as object
      )
    ).toEqual(['all']);
  });
});

describe('LINK-MATERIALIZED-VALUE-0: the write side', () => {
  it('⚠️ write accepts BOTH `{ all: T[] }` and a bare array', async () => {
    const tree = await seeded();

    tree.$.nested({ label: 'z', users: [{ id: 'u2', name: 'Bob' }] });
    await flush();
    let v = tree.$.nested() as Record<string, unknown>;
    expect((v['users'] as { all: User[] }).all).toEqual([
      { id: 'u2', name: 'Bob' },
    ]);

    tree.$.nested({ label: 'w', users: { all: [{ id: 'u3', name: 'Cara' }] } });
    await flush();
    v = tree.$.nested() as Record<string, unknown>;
    expect((v['users'] as { all: User[] }).all).toEqual([
      { id: 'u3', name: 'Cara' },
    ]);

    // ⚠️ THE ASYMMETRY. Read gives one shape; write accepts two. Link's model is
    // symmetric complete-state synchronization, so this is the wart.
  });

  it('the read -> write round trip IS idempotent', async () => {
    const tree = await seeded();

    // So a full-state contract genuinely EXISTS at runtime — this is not the
    // "no coherent contract" outcome. The problem is that the TYPE lies about
    // it and the shape is an internal representation.
    const snapshot = tree.$.nested();
    tree.$.nested(snapshot);
    await flush();

    const after = tree.$.nested() as Record<string, unknown>;
    expect(after['label']).toBe('x');
    expect((after['users'] as { all: User[] }).all).toEqual([
      { id: 'u1', name: 'Alice' },
    ]);
  });

  it('a collection replaces; it does not merge', async () => {
    const tree = await seeded();

    tree.$.nested({ users: [] });
    await flush();

    const after = tree.$.nested() as Record<string, unknown>;
    expect((after['users'] as { all: User[] }).all).toEqual([]);
  });
});
