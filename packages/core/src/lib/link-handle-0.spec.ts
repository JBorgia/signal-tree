import { describe, expect, it } from 'vitest';

import { deepEqual } from './utils';
import { external } from './external';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * LINK-HANDLE-0 — the three unfrozen parts of the returned handle.
 *
 * ```text
 * 1  settled()   WEAK   wait for work already ON the outbound chain
 *                STRONG wait until the link catches up through all link-owned
 *                       work CAUSALLY PENDING at the time of the call,
 *                       including consequences held behind settlement
 * 2  errors      does settled() surface an outbound failure, or is a public
 *                synchronisation failure silently swallowed?
 * 3  disposal    outbound in flight / consequence held / retrieve in flight /
 *                settled() already waiting
 * ```
 *
 * ⚠️ Do not assume STRONG just because the method is called `settled()`. The
 * candidate is `await chain`, which inherits whatever a promise variable
 * happens to mean.
 *
 * ## What mutation removed from the candidate
 *
 * Two clauses were written into `settled()` and neither survived scrutiny:
 *
 * ```text
 * `chain === before` re-check   SUBSUMED. Every appended send is preceded by a
 *                               held observation, so the release-signal wait
 *                               already carries the loop across work enqueued
 *                               behind a completed send. Removing it fails
 *                               nothing — including a test that asserts how
 *                               much work had finished AT the moment settled()
 *                               resolved, which is the direct form of the
 *                               question rather than a timing-dependent one.
 * `inFlightRetrievals` guard    UNTESTED, therefore removed rather than kept on
 *                               faith. Whether `settled()` should also wait for
 *                               an in-flight `retrieve()` is an OPEN CONTRACT
 *                               QUESTION: `retrieve()` returns its own promise,
 *                               so a caller can already await it, and inventing
 *                               a second way to wait for the same thing needs
 *                               its own justification.
 * ```
 *
 * The candidate got smaller twice — the same pattern DEMARCATION-0 hit when a
 * separate echo-suppression check turned out to be the reconciliation loop's
 * first iteration.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

interface LinkEndpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

/**
 * The internal observer, with ONE addition over DEMARCATION-0's: it reports
 * whether an observation is PENDING — marked dirty and handed to the settlement
 * authority, but not yet released. That is the fact `settled()` needs in order
 * to mean anything stronger than "the chain I can see is drained".
 */
function observeCommitted<T>(
  x: unknown,
  cb: (current: T) => void,
  onHeld?: (release: () => void) => void
): () => void {
  const registry = getPositionRegistry(x);
  if (!registry) throw new Error('X must be an owned SignalTree location.');
  const ownerPath = (x as { __ownerPath?: string }).__ownerPath ?? '';
  const notifier = getPathNotifier();
  let off = false;
  let dirty = false;

  const unsubscribe = notifier.subscribe(
    '**',
    (v, prev, path, _o, _origin, _s, _pos, meta) => {
      if (off) return;
      const m = (meta ?? {}) as Record<string, unknown>;
      if (m['ownerId'] !== registry.id) return;
      if (
        ownerPath !== '' &&
        path !== ownerPath &&
        !path.startsWith(`${ownerPath}.`)
      ) {
        return;
      }
      if (v === undefined && prev === undefined) return;
      dirty = true;
    }
  );

  const offFlush = notifier.onFlush?.(() => {
    if (off || !dirty) return;
    dirty = false;
    let release: (() => void) | undefined;
    onHeld?.((r) => void (release = r));
    scheduleDurableConsequence({
      claimant: x as object,
      key: cb,
      run: () => {
        release?.();
        if (off) return;
        cb((x as () => unknown)() as T);
      },
    });
  });

  return () => {
    off = true;
    unsubscribe();
    offFlush?.();
  };
}

type Mode = 'weak' | 'strong';

const link = <T>(x: unknown, endpoint: LinkEndpoint<T>, mode: Mode = 'strong') => {
  const leafSet = (x as { set?: (v: T) => void }).set;
  const write =
    typeof leafSet === 'function'
      ? (v: T) => leafSet.call(x, v)
      : (v: T) => (x as (v: T) => void)(v);
  const readX = () => (x as () => unknown)() as T;

  let knownY: { value: T } | undefined;
  let disposed = false;
  let chain: Promise<unknown> = Promise.resolve();
  let inboundSeq = 0;
  /**
   * ⚠️ WAITERS, NOT A COUNTER. The first version of `settled()` polled a count
   * across `await flush()` — microtasks only — so a settlement arriving on a
   * MACROTASK could never be observed and the loop hit its own guard. Measured:
   * the baseline failed the moment the test confirmed via `setTimeout`.
   *
   * Each held observation now owns a promise that resolves when the settlement
   * authority releases it, so `settled()` waits on a signal instead of spinning.
   */
  const held = new Set<{ promise: Promise<void>; resolve: () => void }>();
  let lastFailure: unknown;

  const acquire = (value: T, seq: number) => {
    if (disposed || seq < inboundSeq) return;
    inboundSeq = seq;
    knownY = { value };
    external(() => write(value));
  };

  const offCommitted = endpoint.set
    ? observeCommitted<T>(
        x,
        () => {
          if (disposed) return;
          chain = chain
            .then(async () => {
              for (;;) {
                if (disposed) return;
                const now = readX();
                if (knownY !== undefined && deepEqual(now, knownY.value)) return;
                await endpoint.set?.(now);
                knownY = { value: now };
              }
            })
            .catch((e) => {
              // The queue must survive a failure — otherwise one rejection
              // wedges the link forever, which is a retry policy's failure mode
              // arriving without a retry policy.
              lastFailure = e;
            });
        },
        (bind) => {
          let resolve!: () => void;
          const promise = new Promise<void>((r) => (resolve = r));
          const entry = { promise, resolve };
          held.add(entry);
          bind(() => {
            held.delete(entry);
            entry.resolve();
          });
        }
      )
    : undefined;

  const offSource = endpoint.subscribe
    ? endpoint.subscribe((v) => acquire(v, ++inboundSeq))
    : undefined;

  return {
    async retrieve() {
      if (!endpoint.get) throw new Error('link: endpoint supplies no get().');
      const seq = ++inboundSeq;
      acquire((await endpoint.get()) as T, seq);
    },
    async settled() {
      if (mode === 'weak') {
        await chain;
        return;
      }
      // STRONG: keep draining while the link still owns work — including
      // observations HELD behind settlement, and anything a completed send
      // caused the reconciler to enqueue.
      for (;;) {
        await chain;
        if (disposed) return;
        if (held.size === 0) break;
        // Wait on the RELEASE SIGNAL, not on a poll. Every appended send is
        // preceded by a held observation, so this is also what carries the loop
        // across work enqueued behind a completed send.
        await Promise.race([...held].map((h) => h.promise));
      }
      if (lastFailure !== undefined) {
        const failure = lastFailure;
        lastFailure = undefined;
        throw failure;
      }
    },
    lastFailure: () => lastFailure,
    heldObservations: () => held.size,
    dispose() {
      disposed = true;
      offCommitted?.();
      offSource?.();
      // Release anyone already inside `settled()`: a disposed link owns no
      // further work, and a held observation's count never returns to zero on
      // its own.
      for (const h of [...held]) {
        held.delete(h);
        h.resolve();
      }
    },
  };
};

const makeTree = () =>
  signalTree({ theme: 'light' }, { enhancers: [restoration(), transactions()] });

// ───────────────────────────────────────────────────────────────────────────
// 1 — the settled() boundary
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-HANDLE-0 case 1: what does settled() actually wait for?', () => {
  it('⚠️ WEAK resolves while an observation is still HELD behind settlement', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    const l = link<string>(tree.$.theme, { set: (v) => void sent.push(v) }, 'weak');

    const p = tree.transaction(() => tree.$.theme.set('B'));
    await flush();

    // The observation has been handed to the settlement authority and is
    // waiting for the transaction. Nothing is on the chain yet.
    expect(l.heldObservations()).toBe(1);

    await l.settled(); // resolves immediately — there is nothing on `chain`

    // ⚠️ THE DEFECT IN THE WEAK READING. `settled()` returned while the link
    // KNOWS it owns future outbound work. A host that awaited this before
    // backgrounding would be told the link was caught up.
    expect(sent).toEqual([]);

    p.confirm();
    await flush();
    await l.settled();
    l.dispose();

    // And then it sends — after the caller was told there was nothing to wait
    // for.
    expect(sent).toEqual(['B']);
  });

  it('STRONG waits through the held observation and its send', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    // ⚠️ ASYNC deliberately. With a synchronous endpoint the send completes
    // inside the same microtask `await settled()` already yields, so a weaker
    // loop passes for the wrong reason — mutation caught exactly that.
    const l = link<string>(
      tree.$.theme,
      {
        set: (v) =>
          new Promise<void>((r) =>
            setTimeout(() => {
              sent.push(v);
              r();
            }, 10)
          ),
      },
      'strong'
    );

    const p = tree.transaction(() => tree.$.theme.set('B'));
    await flush();
    expect(l.heldObservations()).toBe(1);

    // ⚠️ `settled()` is entered WHILE the observation is held, and something
    // else settles the transaction afterwards. That is the case the
    // held-observation condition exists for: without it, `settled()` sees an
    // empty chain and resolves before the send it knows is coming.
    //
    // The honest limit is stated rather than hidden: if NOTHING settles the
    // transaction, STRONG `settled()` waits forever — the same trade
    // `persistence()` already documents for an unresolved optimistic mutation.
    const waiting = l.settled();
    // ⚠️ A MACROTASK, not a microtask. `settled()` must survive at least one
    // full loop iteration in which the chain has not changed AND an
    // observation is still held — which is exactly the state the
    // held-observation condition exists for. A microtask-fast confirm lets a
    // weaker loop pass for the wrong reason; mutation caught that too.
    setTimeout(() => p.confirm(), 5);
    await waiting;
    l.dispose();

    expect(sent).toEqual(['B']);
    expect(l.heldObservations()).toBe(0);
  });

  it('⚠️ STRONG also waits for work a COMPLETED send enqueues behind it', async () => {
    const tree = makeTree();
    await flush();
    const done: string[] = [];
    let release: (() => void) | undefined;
    const l = link<string>(
      tree.$.theme,
      {
        set: (v) =>
          v === 'first'
            ? new Promise<void>((r) => {
                release = () => {
                  done.push('first');
                  r();
                };
              })
            : new Promise<void>((r) =>
                setTimeout(() => {
                  done.push(v);
                  r();
                }, 5)
              ),
      },
      'strong'
    );

    tree.$.theme.set('first');
    await flush();

    // ⚠️ Asserted DIRECTLY rather than by side effect: how much work had
    // finished at the moment `settled()` resolved. Checking `done` afterwards
    // is timing-dependent — an early resolve can still be followed by the
    // second send completing before the assertion runs, which is how a weaker
    // loop passed this arm at first.
    let doneWhenSettled = -1;
    const waiting = l.settled().then(() => {
      doneWhenSettled = done.length;
    });

    // A second turn lands while the first send is in flight, appending more
    // link-owned work AFTER `settled()` captured the chain.
    tree.$.theme.set('second');
    await flush();
    release?.();
    await waiting;
    l.dispose();

    // The weak reading resolves on the first promise alone. This is the second
    // half of the boundary question, and it is why `settled()` re-checks the
    // chain instead of awaiting a captured variable once.
    expect(doneWhenSettled).toBe(2);
    expect(done).toEqual(['first', 'second']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 — outbound failure
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-HANDLE-0 case 2: does settled() surface an outbound failure?', () => {
  it('⚠️ it REJECTS, and the queue still continues', async () => {
    const tree = makeTree();
    await flush();
    let fail = true;
    const sent: string[] = [];
    const l = link<string>(tree.$.theme, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('endpoint down'));
        sent.push(v);
        return Promise.resolve();
      },
    });

    tree.$.theme.set('doomed');
    await flush();

    // A public link otherwise has NO way to tell the application that Y refused
    // the state. Silently swallowing a synchronisation failure is not a
    // contract anything has earned — and `settled()` is the one place the
    // application is already awaiting.
    await expect(l.settled()).rejects.toThrow('endpoint down');

    // ⚠️ AND THE LINK IS NOT WEDGED. Surfacing the failure must not double as a
    // retry policy's failure mode.
    fail = false;
    tree.$.theme.set('later');
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toEqual(['later']);
    expect(tree.$.theme()).toBe('later');
  });

  it('a failure is reported ONCE, not on every later settled()', async () => {
    const tree = makeTree();
    await flush();
    let fail = true;
    const l = link<string>(tree.$.theme, {
      set: () => (fail ? Promise.reject(new Error('down')) : Promise.resolve()),
    });

    tree.$.theme.set('a');
    await flush();
    await expect(l.settled()).rejects.toThrow('down');

    fail = false;
    // A second call with nothing new to do must not re-throw the old failure.
    await expect(l.settled()).resolves.toBeUndefined();
    l.dispose();
  });

  it('CONTROL — a healthy link resolves', async () => {
    const tree = makeTree();
    await flush();
    const l = link<string>(tree.$.theme, { set: () => Promise.resolve() });

    tree.$.theme.set('a');
    await flush();
    await expect(l.settled()).resolves.toBeUndefined();
    l.dispose();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 — disposal
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-HANDLE-0 case 3: disposal', () => {
  it('an outbound set IN FLIGHT is not cancelled, but nothing new begins', async () => {
    const tree = makeTree();
    await flush();
    const done: string[] = [];
    let release: (() => void) | undefined;
    const l = link<string>(tree.$.theme, {
      set: (v) =>
        new Promise<void>((r) => {
          release = () => {
            done.push(v);
            r();
          };
        }),
    });

    tree.$.theme.set('inflight');
    await flush();
    l.dispose();

    tree.$.theme.set('after-dispose');
    await flush();
    release?.();
    await flush();

    // The in-flight promise belongs to the endpoint and cannot be retracted —
    // SignalTree promises no NEW work after disposal, not cancellation of what
    // already escaped.
    expect(done).toEqual(['inflight']);
  });

  it('a HELD observation released after disposal does not send', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    const l = link<string>(tree.$.theme, { set: (v) => void sent.push(v) });

    const p = tree.transaction(() => tree.$.theme.set('held'));
    await flush();
    expect(l.heldObservations()).toBe(1);

    l.dispose();
    p.confirm();
    await flush();

    expect(sent).toEqual([]);
  });

  it('a retrieve() in flight does not apply after disposal', async () => {
    const tree = makeTree();
    await flush();
    let release: (() => void) | undefined;
    const l = link<string>(tree.$.theme, {
      get: () =>
        new Promise<string>((resolve) => {
          release = () => resolve('late');
        }),
    });

    const pending = l.retrieve();
    l.dispose();
    release?.();
    await pending;
    await flush();

    expect(tree.$.theme()).toBe('light');
  });

  it('⚠️ settled() already WAITING resolves rather than hanging', async () => {
    const tree = makeTree();
    await flush();
    let release: (() => void) | undefined;
    const l = link<string>(tree.$.theme, {
      set: () =>
        new Promise<void>((r) => {
          release = r;
        }),
    });

    // ⚠️ NO in-flight send — an observation HELD behind an unsettled
    // transaction, and nothing else. That is what puts `settled()` inside the
    // release-signal wait rather than inside `await chain`, so disposal must
    // resolve the waiter itself. With an in-flight send present the disposed
    // check after `await chain` covers it and this arm proves nothing.
    const pendingTx = tree.transaction(() => tree.$.theme.set('held'));
    await flush();
    expect(l.heldObservations()).toBe(1);

    const waiting = l.settled();
    await flush();
    l.dispose();
    release?.();

    await expect(waiting).resolves.toBeUndefined();
    pendingTx.rollback();
  });
});
