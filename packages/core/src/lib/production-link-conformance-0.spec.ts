import { describe, expect, it } from 'vitest';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * PRODUCTION-LINK-CONFORMANCE-0 — what actually SHIPS.
 *
 * ⚠️ **Preserving the comparison harnesses is not the same as proving the
 * chosen semantics in production.** `LINK-HANDLE-0`, `LINK-HANDLE-1` and
 * `LINK-ECHO-1` each take a `mode` parameter and exist to explain WHY one side
 * of a contrast won — that is why they keep their local harnesses. But a winning
 * candidate asserted only against a local harness is not evidence about the
 * shipped function.
 *
 * This file asserts the WINNING outcomes against the imported production
 * `link()`, and nothing else.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

/** A promise whose resolution this test controls. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

/** Did `p` settle by now? Answered without racing a timer. */
const settledYet = (p: Promise<unknown>) => {
  let done = false;
  void p.then(
    () => (done = true),
    () => (done = true)
  );
  return () => done;
};

const makeTree = () =>
  signalTree({ leaf: 'l0' }, { enhancers: [restoration(), transactions()] });

// ───────────────────────────────────────────────────────────────────────────
// P0 — retrieve() participates in settled()
// ───────────────────────────────────────────────────────────────────────────

describe('PRODUCTION-LINK-CONFORMANCE-0: retrieve participates in settlement', () => {
  it('⚠️ settled() does NOT resolve while an in-flight retrieve is pending', async () => {
    const tree = makeTree();
    await flush();
    const d = deferred<string>();

    const l = link(tree.$.leaf, {
      get: () => d.promise,
      set: () => void 0,
    });

    // ⚠️ THE SHAPE THAT MATTERS. `await retrieve(); await settled();` proves
    // nothing — it waits the retrieval itself. The contract is about a
    // retrieval ALREADY IN FLIGHT when settled() is called separately.
    void l.retrieve();
    const waiting = l.settled();
    const isDone = settledYet(waiting);

    await flush();
    expect(isDone(), 'settled() resolved while get() was still pending').toBe(
      false
    );

    d.resolve('from-endpoint');
    await waiting;

    expect(tree.$.leaf()).toBe('from-endpoint');
    l.dispose();
  });

  it('and it stays pending through outbound work that FOLLOWS the acquisition', async () => {
    const tree = makeTree();
    await flush();
    const get = deferred<string>();
    const sent: string[] = [];

    const l = link(tree.$.leaf, {
      get: () => get.promise,
      set: (v) => void sent.push(v),
    });

    // ⚠️ AN AUTHORED WRITE, NOT THE ACQUISITION ITSELF.
    //
    // An earlier draft expected the acquired value to produce an outbound send
    // and asserted against a deferred `set`. That premise was WRONG: inbound
    // acquisition is ECHO SUPPRESSED, so `set` is never called for it and the
    // test failed for a reason unrelated to settlement. The earned shape is a
    // write authored after the retrieval, which creates real outbound work in
    // the same relationship.
    const retrieving = l.retrieve();
    const settling = l.settled();
    get.resolve('acquired');
    await retrieving;
    tree.$.leaf.set('typed');
    await settling;
    l.dispose();

    // settled() must not resolve BETWEEN the acquisition and the outbound work
    // that follows it.
    expect(sent).toEqual(['typed']);
  });

  it('a retrieve started AFTER settled() began still holds it open', async () => {
    const tree = makeTree();
    await flush();
    const d = deferred<string>();

    const l = link(tree.$.leaf, { get: () => d.promise, set: () => void 0 });

    void l.retrieve();
    const waiting = l.settled();
    const isDone = settledYet(waiting);
    await flush();

    expect(isDone()).toBe(false);
    d.resolve('x');
    await waiting;
    l.dispose();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Disposal
// ───────────────────────────────────────────────────────────────────────────

describe('PRODUCTION-LINK-CONFORMANCE-0: disposal releases every waiter', () => {
  it('dispose() releases a settled() waiting on a pending retrieve', async () => {
    const tree = makeTree();
    await flush();
    const d = deferred<string>();

    const l = link(tree.$.leaf, { get: () => d.promise, set: () => void 0 });

    void l.retrieve();
    const waiting = l.settled();
    const isDone = settledYet(waiting);
    await flush();
    expect(isDone()).toBe(false);

    // A disposed link owns no future work, so anyone already inside settled()
    // must be released rather than left waiting forever.
    l.dispose();
    await waiting;
    // `await waiting` resumes before a separately-registered `.then` runs, so
    // the observer needs one more turn to have been called.
    await flush();
    expect(isDone()).toBe(true);
  });

  it('⚠️ a LATE retrieval result does not mutate X, enqueue, or resurrect', async () => {
    const tree = makeTree();
    await flush();
    const d = deferred<string>();
    const sent: string[] = [];

    const l = link(tree.$.leaf, {
      get: () => d.promise,
      set: (v) => void sent.push(v),
    });

    void l.retrieve();
    l.dispose();
    await flush();

    d.resolve('too-late');
    await flush();
    await flush();

    expect(tree.$.leaf()).toBe('l0');
    expect(sent).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The rest of the chosen semantics
// ───────────────────────────────────────────────────────────────────────────

describe('PRODUCTION-LINK-CONFORMANCE-0: settlement, echo, reconciliation', () => {
  it('a held consequence delays settled() — STRONG, not `await chain`', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];

    const l = link(tree.$.leaf, { set: (v) => void sent.push(v) });

    // ⚠️ A TRANSACTION, and `await flush()` before calling settled(). That is
    // the shape LINK-HANDLE-0 earned: the observation has been HANDED TO THE
    // SETTLEMENT AUTHORITY and is waiting for the transaction, with nothing yet
    // on the chain.
    //
    // An earlier draft called settled() in the same tick as the write, before
    // any flush. That tests something STRONGER than was earned — no observation
    // had reached the authority yet — and it failed for that reason rather than
    // for the WEAK-reading defect this pins.
    const p = tree.transaction(() => tree.$.leaf.set('B'));
    await flush();

    const waiting = l.settled();
    const isDone = settledYet(waiting);
    await flush();

    expect(isDone(), 'settled() drained only the chain it could see').toBe(
      false
    );
    expect(sent).toEqual([]);

    p.confirm();
    await waiting;
    expect(sent).toEqual(['B']);
    l.dispose();
  });

  it('inbound acquisition does NOT echo back to endpoint.set', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    let emit!: (v: string) => void;

    const l = link(tree.$.leaf, {
      set: (v) => void sent.push(v),
      subscribe: (next) => {
        emit = next;
        return () => void 0;
      },
    });

    emit('from-y');
    await flush();
    await l.settled();

    expect(tree.$.leaf()).toBe('from-y');
    // The value came FROM Y. Sending it back is a loop, not a synchronization.
    expect(sent).toEqual([]);
    l.dispose();
  });

  it('a write arriving while set() is in flight is eventually sent', async () => {
    const tree = makeTree();
    await flush();
    const first = deferred<void>();
    const sent: string[] = [];

    const l = link(tree.$.leaf, {
      set: (v) => {
        sent.push(v);
        return sent.length === 1 ? first.promise : Promise.resolve();
      },
    });

    tree.$.leaf.set('a');
    await flush();
    expect(sent).toEqual(['a']);

    // Lands while the first send is still open.
    tree.$.leaf.set('b');
    await flush();

    first.resolve();
    await l.settled();

    // LINK-RACE-1: reconcile until X equals Y's acknowledged state. It
    // terminates on EQUALITY, so the later write is not lost behind the
    // in-flight one.
    expect(sent).toEqual(['a', 'b']);
    expect(tree.$.leaf()).toBe('b');
    l.dispose();
  });
});

describe('PRODUCTION-LINK-CONFORMANCE-0: the chosen error contract', () => {
  it('a rejected set() reports ONCE centrally, and settled() does NOT throw', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const offErr = onTreeError((e) => seen.push(e));

    const tree = makeTree();
    await flush();
    let fail = true;
    const sent: string[] = [];

    const l = link(tree.$.leaf, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('endpoint down'));
        sent.push(v);
        return Promise.resolve();
      },
    });

    tree.$.leaf.set('doomed');
    await flush();

    // ⚠️ LINK-2 is the later public contract and it retires the older
    // "settled() throws" candidate. This must RESOLVE.
    await expect(l.settled()).resolves.toBeUndefined();

    expect(seen).toHaveLength(1);
    expect(seen[0].operation).toBe('link:set');
    // ⚠️ `source` is GONE — it duplicated `operation` and nothing branched on
    // it. Attribution is now `treeId`, and `path` names the linked location.
    expect(seen[0].treeId).toBeDefined();
    expect(seen[0].path).toBe('leaf');
    expect(String(seen[0].error)).toMatch(/endpoint down/);

    // A failed egress does not un-author X.
    expect(tree.$.leaf()).toBe('doomed');

    // And the queue survives: one rejection must not wedge the link forever.
    fail = false;
    tree.$.leaf.set('recovered');
    await flush();
    await l.settled();
    expect(sent).toEqual(['recovered']);

    l.dispose();
    offErr();
    clearTreeErrorListenersForTesting();
  });
});
