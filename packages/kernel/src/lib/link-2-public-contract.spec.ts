import { describe, expect, it } from 'vitest';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  reportTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { link as productionLink } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { withWriteContext } from './write-context';

/**
 * LINK-2 — THE PUBLIC CONTRACT. Deliberately much smaller than LINK-1.
 *
 * LINK-1 settled the CAPABILITY: a two-way link cannot be reproduced correctly
 * in user-land, because self-echo suppression needs a link-local correlation and
 * `external()` cannot stamp one. This file does not retest causality. It answers
 * only the API questions that are NOT yet earned:
 *
 * ```text
 * 1  the exact Endpoint<T> structural contract, and what an EMPTY one does
 * 2  which methods on the returned Link are EARNED, and which are convenience
 * 3  where a rejected outbound set() is OBSERVABLE, with no status/retry/backoff
 * 4  the X constraint — see `link-2-x-constraint.typing.spec.ts`, which
 *    measures that the type rejects only `tree.$`; a computed and a bare
 *    WritableSignal both COMPILE and are refused at runtime instead
 * 5  endpoint COMBINATIONS, including whether get + subscribe is meaningful
 * ```
 *
 * The harness is LINK-1's, extended only where a case requires it. Still
 * test-local; still not an export.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

interface Endpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}


const linkableWrite = <T>(x: unknown): ((value: T) => void) => {
  if (!getPositionRegistry(x)) {
    throw new Error(
      'LINK: X must be an owned SignalTree location (root, branch or leaf).'
    );
  }
  const leafSet = (x as { set?: (v: T) => void }).set;
  if (typeof leafSet === 'function') return (v: T) => leafSet.call(x, v);
  if (typeof x === 'function') return (v: T) => (x as (v: T) => void)(v);
  throw new Error('LINK: X must be writable.');
};

/**
 * PRODUCTION. This battery originally carried a test-local reference
 * harness, which is how the semantics were DISCOVERED. It now exercises the
 * shipped function, so the earned contract cannot drift from what ships.
 */
const makeLink = <T>(x: unknown, endpoint: Endpoint<T>) =>
  productionLink<never>(x as never, endpoint as Endpoint<never>);

const makeTree = () =>
  signalTree(
    { leaf: 'l0', settings: { theme: 'light' } },
    { enhancers: [restoration(), transactions()] }
  );

// ───────────────────────────────────────────────────────────────────────────
// 1 & 5 — the endpoint contract and its combinations
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-2 cases 1 & 5: the endpoint contract', () => {
  it('⚠️ an EMPTY endpoint is refused rather than silently inert', async () => {
    const tree = makeTree();
    await flush();

    // Every member is optional, so `{}` type-checks. It describes no
    // relationship: a link that looks installed and does nothing forever is the
    // worst available outcome.
    expect(() => makeLink(tree.$.leaf, {})).toThrow(/at least one of get, set/);
  });

  it('each single-direction endpoint is valid on its own', async () => {
    const tree = makeTree();
    await flush();

    const pull = makeLink<string>(tree.$.leaf, { get: () => 'g' });
    const push = makeLink<string>(tree.$.leaf, { set: () => void 0 });
    const live = makeLink<string>(tree.$.leaf, { subscribe: () => () => void 0 });

    // WAS `expect(l.linkId).toMatch(/^link#/)`. `linkId` was a REFERENCE-HARNESS
    // artifact and is not on the shipped handle, which is deliberately three
    // members. Asserting it against production would have grown the public
    // surface to satisfy a test rather than a demonstrated need — so the
    // assertion now states the case's actual point: each single-direction
    // endpoint constructs a usable link on its own.
    for (const l of [pull, push, live]) {
      expect(typeof l.retrieve).toBe('function');
      expect(typeof l.settled).toBe('function');
      expect(typeof l.dispose).toBe('function');
      expect((l as unknown as Record<string, unknown>)['linkId']).toBeUndefined();
    }
    for (const l of [pull, push, live]) l.dispose();
  });

  it('retrieve() on a set-only endpoint fails loudly, not silently', async () => {
    const tree = makeTree();
    await flush();
    const link = makeLink<string>(tree.$.leaf, { set: () => void 0 });

    await expect(link.retrieve()).rejects.toThrow(/no get/);
    link.dispose();
  });

  it('⚠️ get + subscribe IS meaningful — snapshot then live', async () => {
    const tree = makeTree();
    await flush();
    let emit: ((v: string) => void) | undefined;
    const link = makeLink<string>(tree.$.leaf, {
      get: () => Promise.resolve('snapshot'),
      subscribe: (next) => {
        emit = next;
        return () => void (emit = undefined);
      },
    });

    await link.retrieve();
    await flush();
    expect(tree.$.leaf()).toBe('snapshot');

    emit?.('live-1');
    await flush();
    expect(tree.$.leaf()).toBe('live-1');
    link.dispose();

    // So the combination is not forbidden. It is the ordinary shape of a
    // subscription that also has a current value.
  });

  it('⚠️ AND IT HAS AN INBOUND STALENESS HAZARD — a slow get must not land on a newer push', async () => {
    const tree = makeTree();
    await flush();
    let release: (() => void) | undefined;
    let emit: ((v: string) => void) | undefined;
    const link = makeLink<string>(tree.$.leaf, {
      get: () =>
        new Promise<string>((resolve) => {
          release = () => resolve('stale-snapshot');
        }),
      subscribe: (next) => {
        emit = next;
        return () => void (emit = undefined);
      },
    });

    const pending = link.retrieve(); // starts first, resolves last
    emit?.('newer-live'); // starts second, lands first
    await flush();
    expect(tree.$.leaf()).toBe('newer-live');

    release?.();
    await pending;
    await flush();
    link.dispose();

    // The mirror of case 5's outbound rule, on the inbound side: an older
    // acquisition may not overwrite a newer one solely because completions
    // reordered. Without the sequence guard this is 'stale-snapshot'.
    expect(tree.$.leaf()).toBe('newer-live');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 — outbound rejection visibility
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-2 case 3: a rejected outbound set() is observable', () => {
  it('⚠️ it reaches the EXISTING central error reporter — no new Link surface', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const offErr = onTreeError((e) => seen.push(e));

    const tree = makeTree();
    await flush();
    const link = makeLink<string>(tree.$.leaf, {
      set: () => Promise.reject(new Error('endpoint down')),
    });

    tree.$.leaf('doomed');
    await flush();
    await link.settled();
    link.dispose();
    offErr();
    clearTreeErrorListenersForTesting();

    // `onTreeError` already exists for exactly this — "one place to observe
    // every error the library catches", built because per-marker `onError`
    // meant wiring Sentry at every call site forever. Reusing it means `Link`
    // needs NO error surface: no `failures`, no error signal, no status. The
    // harness's `failures` array in LINK-1 was a test convenience and is gone.
    expect(seen).toHaveLength(1);
    expect(seen[0].operation).toBe('link:set');
    expect(String(seen[0].error)).toMatch(/endpoint down/);

    // And committed state is unmoved: a failed egress does not un-author X.
    expect(tree.$.leaf()).toBe('doomed');
  });

  it('a listener that throws does not damage the link', async () => {
    clearTreeErrorListenersForTesting();
    const offBad = onTreeError(() => {
      throw new Error('listener exploded');
    });
    const sent: string[] = [];

    const tree = makeTree();
    await flush();
    let fail = true;
    const link = makeLink<string>(tree.$.leaf, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('down'));
        sent.push(v);
        return Promise.resolve();
      },
    });

    tree.$.leaf('first');
    await flush();
    await link.settled();
    fail = false;
    tree.$.leaf('second');
    await flush();
    await link.settled();
    link.dispose();
    offBad();
    clearTreeErrorListenersForTesting();

    // Adding error REPORTING must not become a source of errors. The reporter
    // already guarantees this; the link inherits it rather than re-implementing.
    expect(sent).toEqual(['second']);
  });

  it('⚠️ RESOLVED — `onTreeError` IS exported, once the event became truthful', async () => {
    const barrel = await import('../index');

    // So the mechanism that makes case 3 observable is currently unreachable
    // from an application. It was built to answer an NGXS capability gap
    // (`NgxsUnhandledErrorHandler`) and then left in `internals/`. Every marker
    // that reports through it is equally invisible today, not just a link.
    //
    // This assertion PINS the gap. Exporting it must flip this test.
    // ⚠️ RESOLVED by ERROR-SURFACE-2. This case recorded that the reporter was
    // built to be observed and then never exported, so the "observable"
    // property was true only for the library's own tests.
    //
    // It is exported now, but NOT as it stood: the event first had to become
    // truthful — a REQUIRED `treeId` so two same-shaped trees are
    // distinguishable, `source` and `detail` DELETED from the delivered object,
    // and `path` given one meaning across producers.
    expect('onTreeError' in barrel).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 — which Link methods are EARNED
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-2 case 2: is settled() earned, or convenience?', () => {
  it('⚠️ a SYNCHRONOUS endpoint needs no drain — nothing is ever in flight', async () => {
    const tree = makeTree();
    await flush();
    const store = new Map<string, string>();
    const link = makeLink<string>(tree.$.leaf, {
      set: (v) => void store.set('leaf', v), // localStorage shape: returns void
    });

    tree.$.leaf('v1');
    await flush();

    // No `await settled()`. The value is already durable, because the endpoint
    // completed inside the consequence. This is TruckTrax's actual footprint:
    // seven localStorage leaves.
    expect(store.get('leaf')).toBe('v1');
    link.dispose();
  });

  it('⚠️ an ASYNCHRONOUS endpoint DOES have an in-flight window', async () => {
    const tree = makeTree();
    await flush();
    const store = new Map<string, string>();
    const link = makeLink<string>(tree.$.leaf, {
      set: (v) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            store.set('leaf', v);
            resolve();
          }, 20)
        ),
    });

    tree.$.leaf('v1');
    await flush();

    // The window is real, and a host about to be suspended cannot see it
    // without something to await.
    expect(store.has('leaf')).toBe(false);

    await link.settled();
    expect(store.get('leaf')).toBe('v1');
    link.dispose();
  });
});

/**
 * ## LINK-2 RESULT — what the contract should be
 *
 * ```text
 * Endpoint<T>   get? / set? / subscribe?, all optional, AT LEAST ONE required.
 *               Empty is refused, not silently inert.
 *               get + subscribe is VALID and needs an inbound sequence guard.
 *
 * Link<T>       retrieve()   EARNED — explicit acquisition, and it stays
 *                            explicit: nothing has earned automatic startup
 *                            hydration.
 *               dispose()    EARNED — LINK-1 case 2.
 *               settled()    CONDITIONALLY EARNED. The drain requirement is a
 *                            property of the ENDPOINT'S SYNCHRONY, not of the
 *                            link: a synchronous endpoint has no in-flight
 *                            window at all, and TruckTrax's seven leaves are
 *                            synchronous. An async endpoint does have one, and
 *                            no other public thing can observe it.
 *               clear()      NOT EARNED — that is an endpoint operation.
 *               save()       NOT EARNED — outbound is automatic.
 *               flush()      NOT EARNED — there is no debounce to flush.
 *
 * errors        NO Link surface. Routed to the existing `onTreeError`, which
 *               must be exported for that to mean anything (pinned above).
 * ```
 *
 * Two rules that turned out to be mirror images, and neither is a clock:
 *
 * ```text
 * OUTBOUND  an older set() may not finish after a newer one   (serialize)
 * INBOUND   an older acquisition may not overwrite a newer one (sequence)
 * ```
 */
