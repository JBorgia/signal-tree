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
 * LINK-HANDLE-1 — does an in-flight `retrieve()` participate in `settled()`?
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


/**
 * ```text
 * A  INCLUDED   `settled()` means "this relationship has no link-owned work in
 *               progress or held". `retrieve()` is work INITIATED AND OWNED by
 *               the link, so it participates.
 * B  EXCLUDED   `retrieve()` is an explicit operation with its own promise;
 *               `settled()` covers only outbound settlement/reconciliation.
 * ```
 *
 * ⚠️ LINK-HANDLE-0 removed an `inFlightRetrievals` guard because it was
 * untested, and recorded the question as open. It is NOT decided by
 * implementation convenience: the argument for A is that `retrieve()` can
 * MUTATE X after `settled()` returns, which is misleading in exactly the way
 * the WEAK outbound reading was. Having its own promise is not sufficient to
 * exclude it — per-operation promises and whole-object idle promises routinely
 * coexist.
 */

type Mode = 'included' | 'excluded';

const link = <T>(x: unknown, endpoint: LinkEndpoint<T>, mode: Mode = 'included') => {
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
  let lastFailure: unknown;
  const failures: unknown[] = [];
  const held = new Set<{ promise: Promise<void>; resolve: () => void }>();
  /** In-flight retrievals, as release signals rather than a counter. */
  const retrievals = new Set<{ promise: Promise<void>; resolve: () => void }>();

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
              failures.push(e);
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
    failures,
    async retrieve() {
      if (!endpoint.get) throw new Error('link: endpoint supplies no get().');
      const seq = ++inboundSeq;
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const entry = { promise, resolve };
      retrievals.add(entry);
      try {
        acquire((await endpoint.get()) as T, seq);
      } finally {
        retrievals.delete(entry);
        entry.resolve();
      }
    },
    async settled() {
      for (;;) {
        await chain;
        if (disposed) return;
        if (mode === 'included' && retrievals.size > 0) {
          await Promise.race([...retrievals].map((r) => r.promise));
          continue;
        }
        if (held.size === 0) break;
        await Promise.race([...held].map((h) => h.promise));
      }
      if (lastFailure !== undefined) {
        const failure = lastFailure;
        lastFailure = undefined;
        throw failure;
      }
    },
    dispose() {
      disposed = true;
      offCommitted?.();
      offSource?.();
      for (const s of [...held, ...retrievals]) {
        held.delete(s);
        retrievals.delete(s);
        s.resolve();
      }
    },
  };
};

const makeTree = () =>
  signalTree({ theme: 'light' }, { enhancers: [restoration(), transactions()] });

describe('LINK-HANDLE-1: does settled() include an in-flight retrieve()?', () => {
  const run = async (mode: Mode) => {
    const tree = makeTree();
    await flush();
    let release: (() => void) | undefined;
    const l = link<string>(
      tree.$.theme,
      {
        get: () =>
          new Promise<string>((resolve) => {
            release = () => resolve('acquired');
          }),
      },
      mode
    );

    const retrieving = l.retrieve();
    let settledResolved = false;
    const settling = l.settled().then(() => {
      settledResolved = true;
    });

    await flush();
    const resolvedBeforeAcquisition = settledResolved;
    const xBefore = tree.$.theme();

    release?.();
    await retrieving;
    await settling;
    l.dispose();

    return { resolvedBeforeAcquisition, xBefore, xAfter: tree.$.theme() };
  };

  it('⚠️ EXCLUDED lets settled() resolve BEFORE the acquisition lands', async () => {
    const r = await run('excluded');

    // The link then mutates X after the caller was told the relationship was
    // settled — the same misleading shape as the WEAK outbound reading.
    expect(r.resolvedBeforeAcquisition).toBe(true);
    expect(r.xBefore).toBe('light');
    expect(r.xAfter).toBe('acquired');
  });

  it('INCLUDED waits for the retrieval and its acquisition', async () => {
    const r = await run('included');

    expect(r.resolvedBeforeAcquisition).toBe(false);
    expect(r.xAfter).toBe('acquired');
  });

  it('INCLUDED also waits for outbound work the acquisition causes', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    let release: (() => void) | undefined;
    const l = link<string>(tree.$.theme, {
      get: () =>
        new Promise<string>((resolve) => {
          release = () => resolve('acquired');
        }),
      // A SECOND link would send it; here the acquisition itself is echo
      // suppressed, so an authored write follows to create real outbound work.
      set: (v) => void sent.push(v),
    });

    const retrieving = l.retrieve();
    const settling = l.settled();
    release?.();
    await retrieving;
    tree.$.theme.set('typed');
    await settling;
    l.dispose();

    // `settled()` must not resolve between the acquisition and the outbound
    // work that follows it in the same relationship.
    expect(sent).toEqual(['typed']);
  });

  it('disposal releases a settled() waiting on a retrieval', async () => {
    const tree = makeTree();
    await flush();
    let release: (() => void) | undefined;
    const l = link<string>(tree.$.theme, {
      get: () =>
        new Promise<string>((resolve) => {
          release = () => resolve('late');
        }),
    });

    const retrieving = l.retrieve();
    const waiting = l.settled();
    await flush();
    l.dispose();

    await expect(waiting).resolves.toBeUndefined();
    release?.();
    await retrieving;
    await flush();

    // Consistent with the disposal contract: the value is not applied.
    expect(tree.$.theme()).toBe('light');
  });
});

describe('LINK-HANDLE-1: more than one outbound failure before settled()', () => {
  it('⚠️ two rejections, one settled() — what is actually visible?', async () => {
    const tree = makeTree();
    await flush();
    const l = link<string>(tree.$.theme, {
      set: (v) => Promise.reject(new Error(`failed:${v}`)),
    });

    tree.$.theme.set('A');
    await flush();
    tree.$.theme.set('B');
    await flush();

    let thrown = '';
    try {
      await l.settled();
    } catch (e) {
      thrown = (e as Error).message;
    }
    l.dispose();

    // ⚠️ MEASURED, then chosen. Two distinct failures occurred and `lastFailure`
    // is a single slot, so ONE is surfaced and the other is lost.
    //
    // The disposition, and the reason it is the minimum that makes no false
    // claim: `settled()`'s contract is "this relationship is caught up", and a
    // rejection communicates "it is NOT". WHICH failure is reported is not part
    // of that claim, and the LATEST is the most useful single answer because it
    // describes the most recent attempt.
    //
    // An AggregateError is NOT invented here: no case has been shown where a
    // caller can act differently on two failures than on one, and inventing a
    // richer error shape is the same move as inventing retry/status.
    expect(thrown).toBe('failed:B');
    expect(l.failures.length).toBe(2); // both HAPPENED; one is REPORTED
  });
});
