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

    const pending = tree.transaction(() => {
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

    const pending = tree.transaction(() => {
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

    const pending = tree.transaction(() => {
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
      tree.transaction(() => {
        tree.$.a('doomed');
        throw new Error('boom');
      })
    ).toThrow('boom');

    await flush();

    // A thrown transaction settles as discarded. No publication may expose the
    // rejected value, and a later write must prove that this Link is usable.
    for (const payload of rec.writes) {
      expect(payload['a']).not.toBe('doomed');
    }
    expect(tree.$.a()).toBe('a0');
    tree.$.a('after-throw');
    await flush();
    expect(rec.writes.at(-1)?.['a']).toBe('after-throw');
  });

  it('one tree open transaction does not block another tree Link publication', async () => {
    const recBlocked = recordingStorage();
    const recFree = recordingStorage();

    const blocked = makeTree(recBlocked, 'pco-blocked');
    const free = makeTree(recFree, 'pco-free');

    const pending = blocked.transaction(() => {
      blocked.$.a('a1');
    });

    // A perfectly ordinary write on an unrelated tree.
    free.$.a('free1');

    await flush();

    // Scope presence is keyed by tree identity, so the second tree is
    // unaffected by the first tree's pending transaction.
    expect(recBlocked.writes).toEqual([]);
    expect(recFree.writes.length).toBeGreaterThan(0);
    expect(recFree.writes[recFree.writes.length - 1]).toMatchObject({
      a: 'free1',
    });

    pending.confirm();
  });
});

/**
 * Blocker found by the fresh-HEAD antagonistic audit against 59bed701.
 *
 * `settleCommitScope` sat AFTER the compensation call rather than in a
 * `finally`. Compensation is fallible — it throws a SignalTreeRollbackError
 * when it cannot reconcile conservatively, which is a SUPPORTED fail-closed
 * contract, not an edge case. When it threw, the scope was never settled, so
 * `hasOpenCommitScope(tree)` stayed true forever and publication was wedged for
 * the life of the tree. Post-commit had degraded to never-commit, silently.
 */
describe('public Link publication survives a refused rollback', () => {
  it('is not wedged forever when compensation refuses', async () => {
    const { getTreeRealizationPort } = await import(
      './internals/causal-runtime/tree-realization-adapter'
    );

    const rec = recordingStorage();
    const tree = makeTree(rec, 'pco-refused');

    // Force the fail-closed refusal path.
    const port = getTreeRealizationPort(tree.$);
    if (!port?.validateEffects)
      throw new Error('Expected rollback validation port');
    const original = port.validateEffects;
    let validations = 0;
    port.validateEffects = () => {
      validations++;
      return { kind: 'structural-drift' };
    };

    const pending = tree.transaction(() => {
      tree.$.a('a1');
    });

    try {
      expect(() => pending.rollback()).toThrow(/rollback/i);
      expect(validations).toBeGreaterThan(0);
    } finally {
      port.validateEffects = original;
    }

    // An ordinary, entirely unrelated write on a settled tree must still
    // reach storage. If the scope leaked, publication never fires again.
    tree.$.b('after-refusal');
    await flush();

    expect(rec.writes.length).toBeGreaterThan(0);
    expect(rec.writes.at(-1)).toEqual({ a: 'a1', b: 'after-refusal' });
    pending.confirm();
  });
});

/** v15 releases durable consequences on plan refusal while authority stays pending. */
describe('public Link publication survives a REFUSED ROLLBACK PLAN', () => {
  it('releases persistence after a refused plan while the handle remains pending', async () => {
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

    const pending = tree.transaction(() => {
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

    // v15 retains pending authority but releases the durable scope on refusal.
    expect(refused).toBe(true);

    tree.$.note('after-refusal');
    await flush();
    expect(rec.writes.length).toBeGreaterThan(0);
    expect(rec.writes).toContainEqual({ note: 'after-refusal' });
    expect(() => pending.rollback()).toThrow(/rollback/i);
    pending.confirm();
  });
});
