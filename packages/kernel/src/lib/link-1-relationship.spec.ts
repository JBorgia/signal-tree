import { describe, expect, it } from 'vitest';

import { createReactiveTestRealization } from '../reactive-test-realization';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { link as productionLink } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { withWriteContext } from './write-context';

const testRealization = createReactiveTestRealization();
const computed = testRealization.locations.createDerived;
const signal = testRealization.locations.createCell;

/**
 * LINK-1 — can ONE tiny relationship primitive stay correct when the
 * relationship is genuinely BIDIRECTIONAL, ASYNCHRONOUS and DISPOSABLE, without
 * rebuilding the policies we deliberately removed?
 *
 * LINK-0 answered the causal question: all three directions already work. This
 * asks the harder one, and it cannot be answered by observing the runtime alone
 * — cases 3–5 are properties OF A RELATIONSHIP, so something has to play that
 * role. `makeLink` below is a TEST-LOCAL REFERENCE HARNESS, not an export and
 * not a proposal. Its only privilege is that it is allowed to use core
 * internals, exactly as a core `link()` would.
 *
 * ⚠️ THE POINT OF THE HARNESS IS THAT IT CAN FAIL. If a case cannot be
 * satisfied using only mechanisms this release has already earned, that is a
 * real finding about the design, not about the test.
 *
 * ## Mutation check — every guarantee shown capable of failing
 *
 * A harness that passes on the first run is not evidence. Each guarantee was
 * removed in turn and the suite re-run:
 *
 * ```text
 * remove self-echo correlation check     2 failed  ✓
 * remove outbound serialization          1 failed  ✓
 * remove disposed guard inside run()     1 failed  ✓
 * remove ownership acceptance check      2 failed  ✓
 * remove disposed guard after get()      15 passed ⚠️ REDUNDANT, not vacuous —
 *                                        `acquire` guards both inbound entry
 *                                        points, so either check alone
 *                                        sufficed. Removing BOTH fails the
 *                                        test, so the behaviour IS covered.
 *                                        The redundant check is gone.
 * ```
 *
 * ```text
 * 1  OWNED WRITABLE X      root/branch/leaf yes; computed and a bare
 *                          WritableSignal no
 * 2  DISPOSAL              no NEW link activity after dispose(), and no
 *                          pretence of retracting what already escaped
 * 3  SELF-ECHO             Y --L--> X must not cause X --L--> Y
 * 4  CROSS-LINK            Y1 --L1--> X MAY cause X --L2--> Y2, so
 *                          "ignore all external" is explicitly falsified
 * 5  ASYNC OUTBOUND ORDER  Y must not finish stale solely because completions
 *                          reordered
 * 6  OUTBOUND FAILURE      where a rejected set is owned. No retry, no backoff,
 *                          no status — inventing those rebuilds loader()
 * ```
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// ───────────────────────────────────────────────────────────────────────────
// THE REFERENCE HARNESS
// ───────────────────────────────────────────────────────────────────────────

interface Endpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}


/**
 * `X` is accepted only if it is an OWNED WRITABLE SignalTree LOCATION.
 *
 * Ownership is the discriminator the ownership correction made available: every
 * location — root, branch, leaf — now resolves a registry, and nothing else
 * does. A bare `signal()` has a `.set` but no owner, no settlement authority and
 * no location identity; a `computed` has neither.
 *
 * The three write spellings differ internally (`leaf.set(v)` vs `branch(v)`) and
 * the abstraction erases that difference.
 */
const linkableWrite = <T>(x: unknown): ((value: T) => void) => {
  if (!getPositionRegistry(x)) {
    throw new Error(
      'LINK: X must be an owned SignalTree location (root, branch or leaf).'
    );
  }
  const leafSet = (x as { set?: (v: T) => void }).set;
  if (typeof leafSet === 'function') {
    return (value: T) => leafSet.call(x, value);
  }
  if (typeof x === 'function') {
    return (value: T) => (x as (v: T) => void)(value);
  }
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
    { leaf: 'l0', settings: { theme: 'light', units: 'imperial' } },
    { enhancers: [restoration(), transactions()] }
  );

// ───────────────────────────────────────────────────────────────────────────
// 1 — OWNED WRITABLE X
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-1 case 1: X must be an owned writable SignalTree location', () => {
  it('root, branch and leaf are all accepted, despite different write spellings', async () => {
    const tree = makeTree();
    await flush();

    // The root state location is the callable root accessor; the controller
    // itself owns lifecycle and capabilities but is not writable.
    expect(() => linkableWrite(tree.$)).not.toThrow();
    expect(() => linkableWrite(tree.$.settings)).not.toThrow();
    expect(() => linkableWrite(tree.$.leaf)).not.toThrow();
    expect(() => linkableWrite(tree.$.settings.theme)).not.toThrow();
  });

  it('⚠️ a bare Angular WritableSignal is REFUSED, though it has a setter', async () => {
    const bare = signal('foo');

    // This is the case a `WritableSignal<T>` type bound would wrongly admit. It
    // has no SignalTree owner, so no settlement authority and no location
    // identity — an outbound write from it could never be deferred to a commit.
    expect(() => linkableWrite(bare)).toThrow(/owned SignalTree location/);
  });

  it('a computed is REFUSED — there is no inverse write', async () => {
    const tree = makeTree();
    await flush();
    const derived = computed(() => tree.$.leaf());

    expect(() => linkableWrite(derived)).toThrow(/owned SignalTree location/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 + 4 — SELF-ECHO and CROSS-LINK, together, because each is the other's control
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-1 cases 3 & 4: echo suppression is LINK-LOCAL, not provenance-based', () => {
  it('⚠️ a value acquired through L does not leave through L', async () => {
    const tree = makeTree();
    await flush();
    const writes: string[] = [];
    const link = makeLink<string>(tree.$.leaf, {
      get: () => 'from-endpoint',
      set: (v) => void writes.push(v),
    });

    await link.retrieve();
    await flush();
    await link.settled();
    link.dispose();

    expect(tree.$.leaf()).toBe('from-endpoint');
    // Without suppression this is ['from-endpoint'] — wasteful for a key/value
    // store and an infinite loop for a live source that echoes what it receives.
    expect(writes).toEqual([]);
  });

  it('CONTROL — an AUTHORED write on the same location does go outbound', async () => {
    const tree = makeTree();
    await flush();
    const writes: string[] = [];
    const link = makeLink<string>(tree.$.leaf, {
      set: (v) => void writes.push(v),
    });

    tree.$.leaf.set('typed');
    await flush();
    await link.settled();
    link.dispose();

    // Without this arm, "suppression works" is satisfied by a link that never
    // sends anything.
    expect(writes).toEqual(['typed']);
  });

  it('⚠️ CROSS-LINK — Y1 -> X DOES reach Y2, so "ignore all external" is false', async () => {
    const tree = makeTree();
    await flush();
    const toA: string[] = [];
    const toB: string[] = [];
    const a = makeLink<string>(tree.$.leaf, {
      get: () => 'from-A',
      set: (v) => void toA.push(v),
    });
    const b = makeLink<string>(tree.$.leaf, {
      set: (v) => void toB.push(v),
    });

    await a.retrieve();
    await flush();
    await a.settled();
    await b.settled();
    a.dispose();
    b.dispose();

    // THE DECISIVE PAIR. Suppressing by PROVENANCE ("external never goes
    // outbound") would leave `toB` empty and silently desynchronise B from
    // truth that A supplied. Only a link-local correlation gets both right.
    expect(toA).toEqual([]);
    expect(toB).toEqual(['from-A']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 — ASYNC OUTBOUND ORDER
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-1 case 5: Y may not finish stale because completions reordered', () => {
  const adversarial = () => {
    const done: string[] = [];
    const delays: Record<string, number> = { A: 50, B: 5 };
    return {
      done,
      // An older write that takes TEN TIMES longer than the newer one — the
      // shape that makes concurrent dispatch land on the stale value.
      set: (v: string) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            done.push(v);
            resolve();
          }, delays[v] ?? 1)
        ),
    };
  };

  it('⚠️ serialized outbound writes leave Y at the newest settled X', async () => {
    const tree = makeTree();
    await flush();
    const y = adversarial();
    const link = makeLink<string>(tree.$.leaf, { set: y.set });

    tree.$.leaf.set('A');
    await flush();
    tree.$.leaf.set('B');
    await flush();
    await link.settled();
    link.dispose();

    // Concurrent dispatch gives ['B', 'A'] and leaves Y holding A while X is B.
    // Serialization is the minimal generic guarantee; coalescing waiting writes
    // would be an optimisation on top, not a different contract.
    //
    // ⚠️ This is NOT a debounce. There is no clock window and no interval in
    // which committed state is deliberately not durable — only consequence
    // ORDER is preserved.
    expect(y.done).toEqual(['A', 'B']);
    expect(y.done[y.done.length - 1]).toBe(tree.$.leaf());
  });

  it('CONTROL — unserialized dispatch really does reorder', async () => {
    const y = adversarial();
    await Promise.all([y.set('A'), y.set('B')]);

    // Establishes that the adversarial endpoint can produce the defect at all.
    // Without it, the arm above passes on an endpoint that is simply fast.
    expect(y.done).toEqual(['B', 'A']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 — OUTBOUND FAILURE
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-1 case 6: where does a rejected outbound write go?', () => {
  it('a rejection is captured, not left as an unhandled rejection', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const offErr = onTreeError((e) => seen.push(e));

    const tree = makeTree();
    await flush();
    const link = makeLink<string>(tree.$.leaf, {
      set: () => Promise.reject(new Error('endpoint down')),
    });

    tree.$.leaf.set('doomed');
    await flush();
    await link.settled();

    // The MINIMUM contract, and deliberately the whole of it: an automatic
    // async link must not manufacture invisible unhandled rejections. No retry,
    // no backoff, no error signal, no status — those are what `loader()` was,
    // and they belong to whoever owns the external operation.
    //
    // ⚠️ OBSERVED VIA `onTreeError`, not `link.failures`. LINK-2 case 3 settled
    // where a rejected send goes: the EXISTING central reporter, so `Link` needs
    // no error surface of its own. The harness's `failures` array was a test
    // convenience and is gone from the shipped handle. The SEMANTIC asserted
    // here is unchanged — only where it is observed moved.
    expect(seen).toHaveLength(1);
    expect(seen[0].operation).toBe('link:set');
    expect(String(seen[0].error)).toMatch(/endpoint down/);

    // ⚠️ AND THE TREE IS UNMOVED. A failed egress is not a reason to roll back
    // committed state: X is the truth the application authored, and Y failing
    // to record it does not un-author it.
    expect(tree.$.leaf()).toBe('doomed');
    link.dispose();
    offErr();
    clearTreeErrorListenersForTesting();
  });

  it('a later successful write still goes out after a failure', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const offErr = onTreeError((e) => seen.push(e));

    const tree = makeTree();
    await flush();
    let fail = true;
    const sent: string[] = [];
    const link = makeLink<string>(tree.$.leaf, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('transient'));
        sent.push(v);
        return Promise.resolve();
      },
    });

    tree.$.leaf.set('first');
    await flush();
    await link.settled();
    fail = false;
    tree.$.leaf.set('second');
    await flush();
    await link.settled();
    link.dispose();

    // One rejection must not wedge the serialization chain forever — that would
    // be a retry policy's failure mode arriving without a retry policy.
    expect(seen).toHaveLength(1);
    expect(sent).toEqual(['second']);
    offErr();
    clearTreeErrorListenersForTesting();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 — DISPOSAL (last, because it reuses every other direction)
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-1 case 2: dispose() stops NEW activity, and claims nothing more', () => {
  it('X no longer reaches Y', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(tree.$.leaf, { set: (v) => void sent.push(v) });

    tree.$.leaf.set('before');
    await flush();
    await link.settled();
    link.dispose();

    tree.$.leaf.set('after');
    await flush();
    await link.settled();

    expect(sent).toEqual(['before']);
  });

  it('Y no longer reaches X', async () => {
    const tree = makeTree();
    await flush();
    let emit: ((v: string) => void) | undefined;
    const link = makeLink<string>(tree.$.leaf, {
      subscribe: (next) => {
        emit = next;
        return () => void (emit = undefined);
      },
    });

    emit?.('before');
    await flush();
    expect(tree.$.leaf()).toBe('before');

    link.dispose();
    emit?.('after');
    await flush();

    expect(tree.$.leaf()).toBe('before');
  });

  it('⚠️ a get() resolving AFTER dispose() must not resurrect X', async () => {
    const tree = makeTree();
    await flush();
    let release: (() => void) | undefined;
    const link = makeLink<string>(tree.$.leaf, {
      get: () =>
        new Promise<string>((resolve) => {
          release = () => resolve('late');
        }),
    });

    const pending = link.retrieve();
    link.dispose();
    release?.();
    await pending;
    await flush();

    // The retrieval was in flight and cannot be cancelled — but its RESULT must
    // not be applied to a disposed link's location.
    expect(tree.$.leaf()).toBe('l0');
  });

  it('⚠️ an outbound consequence HELD at dispose time must not escape later', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(tree.$.leaf, { set: (v) => void sent.push(v) });

    // The write is observed and its consequence is HELD by the open scope.
    const pendingTx = tree.transaction(() => tree.$.leaf.set('held'));
    await flush();
    expect(sent).toEqual([]);

    link.dispose();
    pendingTx.confirm();
    await flush();
    await link.settled();

    // Settlement releases the consequence — into a disposed link. It must find
    // the door shut rather than perform an effect the caller has ended.
    expect(sent).toEqual([]);
  });

  it('CONTROL — without dispose(), that same held write DOES escape', async () => {
    const tree = makeTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(tree.$.leaf, { set: (v) => void sent.push(v) });

    const pendingTx = tree.transaction(() => tree.$.leaf.set('held'));
    await flush();
    expect(sent).toEqual([]);

    pendingTx.confirm();
    await flush();
    await link.settled();
    link.dispose();

    // Without this arm, every disposal assertion above is satisfied by a link
    // whose outbound side never worked.
    expect(sent).toEqual(['held']);
  });
});
