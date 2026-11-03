import { afterEach, describe, expect, it } from 'vitest';
import { link } from '../index';
type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
const createStorageAdapter = (
  getItem: StorageAdapter['getItem'],
  setItem: StorageAdapter['setItem'],
  removeItem: StorageAdapter['removeItem']
): StorageAdapter => ({ getItem, setItem, removeItem });
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

interface Recorder {
  readonly adapter: ReturnType<typeof createStorageAdapter>;
  /** Every payload ever written, in order. */
  readonly writes: Array<Record<string, unknown>>;
  readonly map: Map<string, string>;
}

function recordingStorage(): Recorder {
  const map = new Map<string, string>();
  const writes: Array<Record<string, unknown>> = [];
  const adapter = createStorageAdapter(
    (k) => map.get(k) ?? null,
    (k, v) => {
      map.set(k, v);
      try {
        writes.push(JSON.parse(v).data as Record<string, unknown>);
      } catch {
        writes.push({ __unparsed: v });
      }
    },
    (k) => void map.delete(k)
  );
  return { adapter, writes, map };
}

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function makeTree(recorder: Recorder, key: string) {
  const tree = signalTree(
    { a: 'a0', b: 'b0' },
    { enhancers: [transactions()] }
  );
  const connection = link(tree.$, {
    set: (value) =>
      recorder.adapter.setItem(key, JSON.stringify({ data: value })),
  });
  cleanup.push(() => {
    connection.dispose();
    tree.destroy();
  });
  return tree;
}

describe('public Link publication respects the commit boundary', () => {
  it('does not persist while a transaction is open, after queued delivery', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec, 'pco-open');

    const pending = tree.transact(() => {
      tree.$.a('a1');
      tree.$.b('b1');
    });

    await flush();

    // Queued delivery has run by now. Nothing may be durable: the
    // transaction is still speculative.
    expect(rec.writes).toEqual([]);
    expect(rec.map.has('pco-open')).toBe(false);

    pending.confirm();
  });

  it('persists one coherent snapshot after successful settlement', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec, 'pco-confirm');

    const pending = tree.transact(() => {
      tree.$.a('a1');
      tree.$.b('b1');
    });
    await flush();
    expect(rec.writes).toEqual([]);

    pending.confirm();
    await flush();

    // Every snapshot delivered to this root endpoint is internally coherent.
    expect(rec.writes.length).toBeGreaterThan(0);
    for (const payload of rec.writes) {
      expect(payload).toMatchObject({ a: 'a1', b: 'b1' });
    }
  });

  it('never persists a speculative snapshot when the transaction is rolled back', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec, 'pco-rollback');

    const pending = tree.transact(() => {
      tree.$.a('doomed');
    });
    await flush();

    pending.rollback();
    await flush();

    // Correctness is "never wrote", not "wrote and compensated": no payload
    // storage ever held may contain the rejected value.
    for (const payload of rec.writes) {
      expect(payload['a']).not.toBe('doomed');
    }
    expect(tree.$.a()).toBe('a0');
  });

  it('releases the deferred save when the transaction throws', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec, 'pco-throw');

    expect(() =>
      tree.transact(() => {
        tree.$.a('doomed');
        throw new Error('boom');
      })
    ).toThrow('boom');

    await flush();

    // A thrown transaction settles as discarded, so publication must be released
    // rather than held forever — and what it then writes is the restored
    // baseline, never the doomed value.
    for (const payload of rec.writes) {
      expect(payload['a']).not.toBe('doomed');
    }
    expect(tree.$.a()).toBe('a0');
  });

  it('undeclared foreign write holds then publishes after owner confirmation', async () => {
    const recBlocked = recordingStorage();
    const recFree = recordingStorage();
    const blocked = makeTree(recBlocked, 'pco-blocked');
    const free = makeTree(recFree, 'pco-free');
    await flush(); recBlocked.writes.length = 0; recFree.writes.length = 0;
    const pending = blocked.transact(() => blocked.$.a('a1'));
    free.$.a('free1');
    await flush();
    expect(free.$.a()).toBe('free1');
    expect(recBlocked.writes).toEqual([]);
    expect(recFree.writes).toEqual([]);
    pending.confirm();
    await flush();
    expect(recFree.writes.length).toBeGreaterThan(0);
    expect(recFree.writes.at(-1)).toEqual({ a: 'free1', b: 'b0' });
    expect(recBlocked.writes.at(-1)).toEqual({ a: 'a1', b: 'b0' });
  });
});

/** Refusal preserves the pending authority and its durable hold until settlement. */
describe('public Link publication survives a refused rollback', () => {
  it('holds persistence after refusal and releases it after a successful retry', async () => {
    const { getTreeRealizationPort } = await import(
      './internals/causal-runtime/tree-realization-adapter'
    );

    const rec = recordingStorage();
    const tree = makeTree(rec, 'pco-refused');

    const { transactionLifecycleReader } = await import(
      './internals/transaction-lifecycle-view'
    );
    const port = getTreeRealizationPort(tree.$);
    if (!port?.prepareSelectedUnit) {
      throw new Error('Expected selected preparation port');
    }
    const original = port.prepareSelectedUnit;
    const pending = tree.transact(() => {
      tree.$.a('a1');
    });
    const reader = transactionLifecycleReader(tree);
    if (!reader) throw new Error('Expected transaction lifecycle reader');
    const beforePending = reader.snapshot().pending;
    expect(beforePending).toHaveLength(1);
    const beforeState = tree.$();
    expect(beforeState).toEqual({ a: 'a1', b: 'b0' });

    // Inject generic selected-preparation refusal before any installable plan.
    // This is not an authentic structural-drift witness.
    const refusal = new Error('injected pre-install selected preparation failure');
    let refusalCalls = 0;
    let returnedPlans = 0;
    port.prepareSelectedUnit = function (...args) {
      refusalCalls++;
      if (refusalCalls === 1) throw refusal;
      const plan = original.apply(this, args);
      returnedPlans++;
      return plan;
    };
    expect(original).toBeTypeOf('function');
    try {
      expect(() => pending.rollback()).toThrow();
      expect(refusalCalls).toBe(1);
      expect(returnedPlans).toBe(0);
      expect(tree.$()).toEqual(beforeState);
      expect(reader.snapshot().pending).toEqual(beforePending);
    } finally {
      port.prepareSelectedUnit = original;
    }

    // Refusal did not settle the tree, even if the next write is unrelated.
    tree.$.b('after-refusal');
    await flush();
    expect(rec.writes).toEqual([]);
    pending.rollback();
    await flush();
    expect(rec.writes.length).toBeGreaterThan(0);
    expect(rec.writes.at(-1)).toMatchObject({ a: 'a0', b: 'after-refusal' });
  });
});

/** A plan conflict also preserves the durable hold; refusal is not admission. */
describe('public Link publication survives a REFUSED ROLLBACK PLAN', () => {
  it('holds persistence after a plan conflict until explicit confirmation', async () => {
    const { entityMap } = await import('./markers/entity-map');

    const { resetPathNotifier } = await import('./path-notifier');
    resetPathNotifier();

    const rec = recordingStorage();
    const tree = signalTree(
      {
        note: 'n0',
        rows: entityMap<{ id: string; name: string }, string>({
          selectId: (r) => r.id,
        }),
      },
      { enhancers: [transactions()] }
    );
    // The public type permits collection and scalar sources individually.
    const rows = link(tree.$.rows, {
      set: (value) =>
        rec.adapter.setItem('rows', JSON.stringify({ data: { rows: value } })),
    });
    const note = link(tree.$.note, {
      set: (value) =>
        rec.adapter.setItem('note', JSON.stringify({ data: { note: value } })),
    });
    cleanup.push(() => {
      rows.dispose();
      note.dispose();
      tree.destroy();
    });

    const pending = tree.transact(() => {
      tree.$.rows.addOne({ id: 'r1', name: 'Ada' });
    });

    // A later write to the same subject makes conservative rollback refuse.
    // The two microtask turns are required for the dependent write to be
    // captured before the plan is built — same idiom as the shipped
    // "application refetch fallback" case in transactions.spec.ts.
    tree.$.rows.byIdOrFail('r1').name('Alicia');
    await Promise.resolve();
    await Promise.resolve();

    let refused = false;
    try {
      pending.rollback();
    } catch {
      refused = true;
    }

    // The scope remains open because the transaction is still pending.
    expect(refused).toBe(true);

    tree.$.note('after-refusal');
    await flush();
    expect(rec.writes).toEqual([]);
    pending.confirm();
    await flush();
    expect(rec.writes.length).toBeGreaterThan(0);
  });
});
