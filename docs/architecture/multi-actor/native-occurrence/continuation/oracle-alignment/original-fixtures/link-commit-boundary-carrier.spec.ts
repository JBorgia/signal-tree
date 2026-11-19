import { afterEach, describe, expect, it } from 'vitest';

import { link } from '../index';
import { resetPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

/**
 * Shared durable-consequence assertions migrated from the retired serializer.
 * These rows retain the bare-write control, confirm/throw, supersession,
 * overlapping out-of-order settlement and foreign-tree scope assertions.
 * Public Link carries the authority; JSON here is application endpoint policy.
 */

type S = { a: string; b: string };

const flush = async () => {
  await Promise.resolve();
  for (let i = 0; i < 8; i++) await Promise.resolve();
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

const makeTree = (adapter: StorageAdapter, key: string) => {
  const tree = signalTree(
    { a: 'a0', b: 'b0' },
    { enhancers: [transactions()] }
  );
  const connection = link(tree.$, {
    set: (value) => adapter.setItem(key, JSON.stringify({ data: value })),
  });
  cleanup.push(() => {
    connection.dispose();
    tree.destroy();
  });
  return tree;
};

describe('the durable commit boundary, carried by public Link', () => {
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

    const pending = tree.transact(() => {
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
      tree.transact(() => {
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

    const first = tree.transact(() => tree.$.a('FIRST'));
    const second = tree.transact(() => tree.$.a('SECOND'));

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

    const foreignPending = foreign.transact(() => foreign.$.a('THEIRS'));

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
