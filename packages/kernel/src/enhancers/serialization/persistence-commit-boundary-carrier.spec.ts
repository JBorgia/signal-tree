import { describe, expect, it } from 'vitest';

import { persistence } from './serialization';
import { resetPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import type { StorageAdapter } from './storage-adapters';

/**
 * THE COMMIT BOUNDARY FOR DURABLE WRITES — successor carrier.
 *
 * ⚠️ WHY THIS FILE EXISTS. These invariants were real and general, and every
 * one of them was observed ONLY through `stored()` — in
 * `stored-commit-ordering.spec.ts` and in a `describe('… observed through
 * stored()')` block inside `commit-consequence.spec.ts`. `stored()` is a frozen
 * DELETE, so retiring it would have taken the invariants with it.
 *
 * A carrier check found the rest already carried elsewhere:
 *
 *   a rolled-back value is never durable   a2-persistence-discriminators case 3
 *   the drain respects settlement          a2-4-1-drain-settlement
 *   owner isolation                        persistence-as-link-swap-0 P8
 *   inspection never egresses              persistence-as-link-swap-0 P2/P2c/P3
 *
 * What was NOT carried anywhere is below: CONFIRM (as opposed to rollback), a
 * THROWN transaction, a SUPERSEDED intermediate, OUT-OF-ORDER confirm of
 * overlapping transactions, and FOREIGN-tree scope absorption. This file is the
 * minimum carrier added BEFORE the deletion, per STORED-R-C.
 *
 * The subject moved from the marker to the enhancer, which is the whole point:
 * the boundary was never `stored()`'s property. It belongs to the durable
 * consequence authority, which Link now claims on persistence's behalf.
 */

type S = { a: string; b: string };

const flush = async () => {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 350));
};

function recordingAdapter() {
  const writes: string[] = [];
  const store = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(v);
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
  return { adapter, writes };
}

const durable = (writes: string[]): S[] =>
  writes.map((w) => (JSON.parse(w) as { data: S }).data);

type Tx = { confirm(): void; rollback(): void };
type Tree = ReturnType<typeof signalTree<S>> & {
  transaction(fn: () => void): Tx;
};

const makeTree = (adapter: StorageAdapter, key: string) =>
  signalTree({ a: 'a0', b: 'b0' }, {
    enhancers: [
      transactions(),
      persistence({ key, storage: adapter, debounceMs: 0, autoLoad: false }),
    ],
  }) as unknown as Tree;

describe('the durable commit boundary, carried by persistence()', () => {
  it('CONTROL — a bare write with no transaction becomes durable', async () => {
    resetPathNotifier();
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'cb-bare');
    await flush();
    writes.length = 0;

    tree.$.a('dark');
    await flush();

    // Without this control, "nothing speculative was written" would be
    // satisfied by an enhancer that writes nothing at all.
    expect(durable(writes).at(-1)?.a).toBe('dark');
  });

  it('an unconfirmed transaction is not durable; confirm publishes final values only', async () => {
    resetPathNotifier();
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'cb-confirm');
    await flush();
    writes.length = 0;

    const pending = tree.transaction(() => {
      tree.$.a('a1');
      tree.$.a('a2'); // superseded — must never be durable
      tree.$.b('b1');
    });
    await flush();

    expect(writes).toEqual([]); // nothing durable while unconfirmed
    expect(tree.$.a()).toBe('a2'); // live state is unaffected

    pending.confirm();
    await flush();

    const seen = durable(writes);
    expect(seen.at(-1)).toEqual({ a: 'a2', b: 'b1' });
    // THE SUPERSEDED INTERMEDIATE NEVER APPEARS — not even in a payload that
    // was later corrected. Write-then-compensate is not the same as never
    // writing, because a process death between the two leaves 'a1' durable.
    expect(seen.some((v) => v.a === 'a1')).toBe(false);
  });

  it('a THROWN transaction makes zero speculative writes', async () => {
    resetPathNotifier();
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'cb-throw');
    await flush();
    writes.length = 0;

    expect(() =>
      tree.transaction(() => {
        tree.$.a('doomed');
        throw new Error('boom');
      })
    ).toThrow();
    await flush();

    expect(writes.some((w) => w.includes('doomed'))).toBe(false);
  });

  it('out-of-order confirm cannot resurrect a value a later transaction superseded', async () => {
    resetPathNotifier();
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'cb-order');
    await flush();
    writes.length = 0;

    const first = tree.transaction(() => tree.$.a('FIRST'));
    const second = tree.transaction(() => tree.$.a('SECOND'));

    // Confirmed in the WRONG order: the later transaction settles first.
    second.confirm();
    await flush();
    first.confirm();
    await flush();

    // Durable truth must agree with the tree, whatever order the scopes
    // settled in. Confirmation order is not authorship order.
    expect(durable(writes).at(-1)?.a).toBe(tree.$.a());
  });

  it("a FOREIGN tree's open transaction neither absorbs nor delays this tree's write", async () => {
    resetPathNotifier();
    const mine = recordingAdapter();
    const theirs = recordingAdapter();
    const tree = makeTree(mine.adapter, 'cb-mine');
    const foreign = makeTree(theirs.adapter, 'cb-theirs');
    await flush();
    mine.writes.length = 0;
    theirs.writes.length = 0;

    const foreignPending = foreign.transaction(() => foreign.$.a('THEIRS'));

    // My write is not inside anybody's scope, so it must be durable now.
    tree.$.a('MINE');
    await flush();

    expect(durable(mine.writes).at(-1)?.a).toBe('MINE');
    expect(theirs.writes).toEqual([]); // and theirs is still held

    foreignPending.rollback();
    await flush();

    // Their rollback does not reach into my durable truth.
    expect(durable(mine.writes).at(-1)?.a).toBe('MINE');
  });
});
